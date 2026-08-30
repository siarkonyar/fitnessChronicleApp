import { beforeEach, describe, expect, it } from "vitest";
import {
  BUCKET_CAPACITY,
  FREE_TOKEN_CAP,
  MIN_HEADROOM_TOKENS,
  PREMIUM_TOKEN_CAP,
} from "../../src/quota/caps.js";
import {
  callCoach,
  callUsagePercentage,
  catchCallableError,
  clearUsage,
  createTestUser,
  readUsage,
  seedUsage,
  validCoachRequest,
} from "./setup.js";

/**
 * The token-allowance gate.
 *
 * Every case here is a REJECTION, deliberately. A test of the happy path would
 * have to let the turn through to Gemini, which costs money and makes CI
 * depend on a model's mood. The rejections are also the paths that actually
 * protect the bill.
 */
describe("token quota", () => {
  beforeEach(async () => {
    await clearUsage();
  });

  it("refuses a free-tier user who has spent their allowance", async () => {
    const { uid } = await createTestUser();
    // Free users have a real allowance now, so the interesting case is one who
    // has used it up — this used to pass merely because FREE_TOKEN_CAP was 0
    // and every free user was refused on contact.
    await seedUsage(uid, {
      tier: "free",
      tokensUsed: FREE_TOKEN_CAP - (MIN_HEADROOM_TOKENS - 100),
    });

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/resource-exhausted");
    expect(failure.details).toEqual({ reason: "quota" });
  });

  it("refuses a premium user with less than the headroom left", async () => {
    const { uid } = await createTestUser();
    // Inside MIN_HEADROOM_TOKENS of the cap, so still refused even though the
    // raw balance is positive — a turn's cost is unknown until it has run.
    await seedUsage(uid, {
      tier: "premium",
      tokensUsed: PREMIUM_TOKEN_CAP - (MIN_HEADROOM_TOKENS - 100),
    });

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/resource-exhausted");
    expect(failure.details).toEqual({ reason: "quota" });
  });

  it("creates the usage document on a brand-new user's first contact", async () => {
    const { uid } = await createTestUser();
    expect(await readUsage(uid)).toBeUndefined();

    // Deliberately the usage endpoint rather than the coach. The document is
    // created inside checkQuota, which both callers run, so this proves the
    // same thing — and it cannot be seeded first, because the whole point is
    // that no document exists yet. Calling the coach here would send a real
    // turn to Gemini now that free users have an allowance to spend.
    // getUsagePercentage is genuine first contact anyway: the app hits it every
    // time the chat box opens.
    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage).toBeDefined();
    expect(usage?.tokensUsed).toBe(0);
    // Never inferred from the request. A client that could set this would have
    // no quota at all.
    expect(usage?.tier).toBe("free");
    expect(usage?.periodStart).toBeDefined();
  });

  it("spends one bucket token on a turn, even one it goes on to refuse", async () => {
    const { uid } = await createTestUser();
    // Seeded over the allowance so the quota gate is what refuses this turn.
    // Without the seed a free user now has a real budget, sails through both
    // gates, and the "refusal" this test names becomes a live Gemini call.
    await seedUsage(uid, {
      tier: "free",
      tokensUsed: FREE_TOKEN_CAP - (MIN_HEADROOM_TOKENS - 100),
    });

    await catchCallableError(() => callCoach(validCoachRequest()));

    // The ordering guarantee from check.ts: the bucket is spent before the
    // allowance is judged. Without it, a user who is out of allowance could
    // hammer the endpoint for free.
    expect((await readUsage(uid))?.rateTokens).toBe(BUCKET_CAPACITY - 1);
  });

  it("reports 0% for a free user who has spent nothing", async () => {
    await createTestUser();

    // FREE_TOKEN_CAP is a real allowance now, so a fresh free user sits at the
    // bottom of their bar rather than the top. Back when the cap was 0 this
    // asserted 100, which was the 0/0 guard inside toPercentUsed showing
    // through — that guard is covered directly in test/unit/percent.test.ts
    // now, so it no longer rides on the free cap happening to be zero.
    const result = (await callUsagePercentage()) as { data: unknown };

    expect(result.data).toBe(0);
  });

  it("does not spend a bucket token when only reading the percentage", async () => {
    const { uid } = await createTestUser();

    await callUsagePercentage();
    await callUsagePercentage();
    await callUsagePercentage();

    // The app calls this every time the chat box opens. If it drew from the
    // bucket, opening and closing the chat five times would lock the user out
    // of the coach without a single message being sent.
    expect((await readUsage(uid))?.rateTokens).toBeUndefined();
  });
});
