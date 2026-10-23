/**
 * The app's AI client (lib/ai/coachServer.ts) against the real callables in
 * the Functions emulator: the response the server really sends must parse
 * with the app's schemas, and every refusal must arrive in the shape the app
 * reads.
 *
 * No call here reaches Gemini. Each chatWithCoach call is refused by auth,
 * validation or quota first, which is also how a long history is proven to
 * pass validation without running the model.
 */
import { readRejectionReason } from "@/lib/ai/coachErrors";
import { callAiUsage, callCoach, type CoachRequest } from "@/lib/ai/coachServer";
import { getTodayString } from "@/lib/dateUtils";
import { toPlanCardState } from "@/lib/planSummary";
import {
  caught,
  daysFromNow,
  seedUsage,
  signOutUser,
  signUpNewUser,
  waitFor,
  readAsAdmin,
  type TestUser,
} from "./support/emulator";

/** Far beyond any tier's allowance, with the period still running. */
const EXHAUSTED = 1_000_000_000_000;

const request = (overrides: Partial<CoachRequest> = {}): CoachRequest => ({
  conversationId: "integration-coach-conversation",
  message: "Plan my week",
  history: [],
  today: getTodayString(),
  prefs: { repType: "range", measure: "kg" },
  ...overrides,
});

let user: TestUser;

beforeEach(async () => {
  user = await signUpNewUser();
  // onUserCreated opens the free period; wait so seeds never race it.
  await waitFor(async () => (await readAsAdmin(`aiUsage/${user.uid}`)) !== undefined);
});

describe("getUsagePercentage", () => {
  test("a new user's allowance parses with the app's schema as an unused free plan", async () => {
    const usage = await callAiUsage();

    expect(usage).toMatchObject({ tier: "free", percentUsed: 0, activeUntil: null, billingPeriod: null });
    expect(usage.resetsAt).not.toBeNull();
    expect(new Date(usage.resetsAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  test("the plan card renders a new user's response as the free plan", async () => {
    const state = toPlanCardState(await callAiUsage(), false, new Date());

    expect(state).toMatchObject({ kind: "content", summary: { title: "Free plan", activeUntil: null } });
  });

  test("a paid yearly plan reaches the plan card with its period and expiry", async () => {
    await seedUsage(user.uid, {
      tier: "pro",
      tokensUsed: 0,
      entitlementExpiresAt: daysFromNow(300),
      productId: "hercule_pro_yearly",
    });

    const usage = await callAiUsage();
    const state = toPlanCardState(usage, false, new Date());

    expect(usage).toMatchObject({ tier: "pro", billingPeriod: "yearly" });
    expect(usage.activeUntil).not.toBeNull();
    expect(state).toMatchObject({ kind: "content", summary: { title: "Pro yearly" } });
  });

  test("a paid tier whose entitlement has lapsed reads as free", async () => {
    await seedUsage(user.uid, {
      tier: "max",
      tokensUsed: 0,
      entitlementExpiresAt: daysFromNow(-1),
      productId: "hercule_max_monthly",
    });

    expect((await callAiUsage()).tier).toBe("free");
  });

  test("an exhausted allowance reads as at least 100%, which locks the composer", async () => {
    await seedUsage(user.uid, { tier: "free", tokensUsed: EXHAUSTED });

    expect((await callAiUsage()).percentUsed).toBeGreaterThanOrEqual(100);
  });

  test("opening the chat repeatedly never spends the rate limit", async () => {
    for (let i = 0; i < 8; i += 1) await callAiUsage();

    // Refused for quota, not for typing too fast: the reads spent no tokens.
    await seedUsage(user.uid, { tokensUsed: EXHAUSTED });
    expect((await caught(() => callCoach(request()))).details).toEqual({ reason: "quota" });
  });

  test("is refused for a signed-out caller", async () => {
    await signOutUser();

    expect((await caught(() => callAiUsage())).code).toBe("unauthenticated");
  });
});

describe("chatWithCoach refusals", () => {
  test("a signed-out caller is refused before anything else", async () => {
    await signOutUser();

    expect((await caught(() => callCoach(request()))).code).toBe("unauthenticated");
  });

  test.each([
    ["an empty message", { message: "" }],
    ["a message over 2000 characters", { message: "x".repeat(2001) }],
    ["an unknown rep type", { prefs: { repType: "exact", measure: "kg" } }],
    ["an unknown unit", { prefs: { repType: "range", measure: "stone" } }],
    ["a malformed date", { today: "10/06/2026" }],
    ["a date far from the server's", { today: "2001-01-01" }],
  ])("%s is rejected as invalid-argument", async (_name, overrides) => {
    const error = await caught(() => callCoach(request(overrides as Partial<CoachRequest>)));

    expect(error.code).toBe("invalid-argument");
  });

  test("a message of exactly 2000 characters passes validation", async () => {
    await seedUsage(user.uid, { tokensUsed: EXHAUSTED });

    expect((await caught(() => callCoach(request({ message: "x".repeat(2000) })))).code).toBe(
      "resource-exhausted",
    );
  });

  test("a 50-message history passes validation; the server trims it itself", async () => {
    await seedUsage(user.uid, { tokensUsed: EXHAUSTED });
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("model" as const),
      text: `message ${i}`,
    }));

    expect((await caught(() => callCoach(request({ history })))).code).toBe("resource-exhausted");
  });

  test("an exhausted allowance is refused with reason quota", async () => {
    await seedUsage(user.uid, { tokensUsed: EXHAUSTED });

    const error = await caught(() => callCoach(request()));

    expect(error.code).toBe("resource-exhausted");
    expect(error.details).toEqual({ reason: "quota" });
  });

  test("an empty rate bucket is refused with reason rate_limit", async () => {
    await seedUsage(user.uid, {
      tier: "pro",
      entitlementExpiresAt: daysFromNow(300),
      tokensUsed: 0,
      rateTokens: 0,
      rateLastRefill: Date.now(),
    });

    const error = await caught(() => callCoach(request()));

    expect(error.code).toBe("resource-exhausted");
    expect(error.details).toEqual({ reason: "rate_limit" });
  });

  test("the app reads the server's real refusals with the device-shaped code", async () => {
    // The functions shim delivers codes the way React Native Firebase does on
    // device ("resource-exhausted", no prefix): the spelling that used to
    // fall through to the generic error banner.
    await seedUsage(user.uid, { tokensUsed: EXHAUSTED });
    expect(readRejectionReason(await caught(() => callCoach(request())))).toBe("quota");

    await seedUsage(user.uid, {
      tier: "pro",
      entitlementExpiresAt: daysFromNow(300),
      tokensUsed: 0,
      rateTokens: 0,
      rateLastRefill: Date.now(),
    });
    expect(readRejectionReason(await caught(() => callCoach(request())))).toBe("rate_limit");
  });

  test("the app does not mistake validation or auth errors for a refusal", async () => {
    expect(readRejectionReason(await caught(() => callCoach(request({ message: "" }))))).toBeNull();

    await signOutUser();
    expect(readRejectionReason(await caught(() => callCoach(request())))).toBeNull();
  });
});
