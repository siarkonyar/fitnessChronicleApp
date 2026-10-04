import { beforeEach, describe, expect, it } from "vitest";
import {
  BUCKET_CAPACITY,
  FREE_TOKEN_CAP,
  MIN_HEADROOM_TOKENS,
  PRO_TOKEN_CAP,
} from "../../src/quota/caps.js";
import { ENTITLEMENT_GRACE_HOURS } from "../../src/quota/entitlement.js";
import { FREE_PERIOD_DAYS } from "../../src/quota/period.js";
import {
  activeEntitlement,
  callCoach,
  callUsagePercentage,
  catchCallableError,
  clearUsage,
  createTestUser,
  readUsage,
  seedUsage,
  waitForUsageToExist,
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

  it("refuses a pro user with less than the headroom left", async () => {
    const { uid } = await createTestUser();
    // Inside MIN_HEADROOM_TOKENS of the cap, so still refused even though the
    // raw balance is positive — a turn's cost is unknown until it has run.
    await seedUsage(uid, {
      tier: "pro",
      entitlementExpiresAt: activeEntitlement(),
      tokensUsed: PRO_TOKEN_CAP - (MIN_HEADROOM_TOKENS - 100),
    });

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/resource-exhausted");
    expect(failure.details).toEqual({ reason: "quota" });
  });

  it("creates the usage document for a user who has none", async () => {
    const { uid } = await createTestUser();

    // onUserCreated now writes this document at signup, so the empty state has
    // to be constructed rather than assumed. The lazy path being tested here
    // is still the real guarantee, and still load-bearing twice over: every
    // user who predates that trigger has no document, which is what lets this
    // change ship without a migration, and onUserCreated deliberately swallows
    // its own failures because this path will catch them.
    expect(await waitForUsageToExist(uid)).toBe(true);
    await clearUsage();
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
    expect(usage?.periodEnd).toBeDefined();
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
    const result = (await callUsagePercentage()) as {
      data: { percentUsed: number; resetsAt: string; tier: string };
    };

    expect(result.data.percentUsed).toBe(0);

    // The other two fields of the contract, asserted here because this is the
    // only test that sees the wire payload rather than the Firestore document.
    // tier ships today always saying "free"; it exists so that adding paid
    // tiers later does not change the response shape under installed apps.
    expect(result.data.tier).toBe("free");

    // A free user's first period opens on this very call, so the reset date is
    // roughly FREE_PERIOD_DAYS out. Asserted as a range, not an instant: the
    // emulator's clock and ours are not the same millisecond.
    const daysAway =
      (Date.parse(result.data.resetsAt) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAway).toBeGreaterThan(FREE_PERIOD_DAYS - 1);
    expect(daysAway).toBeLessThanOrEqual(FREE_PERIOD_DAYS);
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * The allowance clock and the access clock, through the real callable.
 *
 * The rules themselves are proved in test/unit/period.test.ts, which runs in
 * milliseconds and covers far more cases than is sensible here. What these two
 * cannot prove, and this suite can, is that checkQuota actually READS
 * entitlementExpiresAt off the document. A decidePeriod that is perfect and
 * never handed the field would pass every unit test and still refill nobody.
 *
 * Seeded by hand here. In production syncCustomer writes them from the
 * RevenueCat extension's customer document — see syncCustomer.test.ts.
 */
describe("paid allowance periods", () => {
  beforeEach(async () => {
    await clearUsage();
  });

  it("refills a paid allowance inside a still-valid entitlement", async () => {
    // The annual-subscriber case: one long entitlement, sliced into months.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      // This month's slice ended yesterday...
      periodEnd: new Date(Date.now() - MS_PER_DAY),
      // ...but the subscription itself runs for most of another year.
      entitlementExpiresAt: new Date(Date.now() + 300 * MS_PER_DAY),
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage?.tokensUsed).toBe(0);
    // Still pro. A refill is not a downgrade.
    expect(usage?.tier).toBe("pro");
    expect(usage?.periodEnd.toMillis()).toBeGreaterThan(Date.now());
  });

  it("freezes, but does not downgrade, a lapsed subscriber inside the grace", async () => {
    // A RENEWAL webhook that is merely LATE. RevenueCat retries for about
    // 2h35m, and the renewal may well have been charged already, so the user
    // keeps their tier and their remaining tokens — they just stop growing.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      periodEnd: new Date(Date.now() - 2 * MS_PER_HOUR),
      entitlementExpiresAt: new Date(Date.now() - MS_PER_HOUR),
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage?.tokensUsed).toBe(1_000_000);
    expect(usage?.tier).toBe("pro");
  });

  it("drops a lapsed subscriber to free once the grace has run out", async () => {
    // A LOST expiry webhook, not a late one. Without this bound the user
    // would keep a 3,000,000 token cap forever, with a counter that never
    // resets and a reset date permanently in the past.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      periodEnd: new Date(Date.now() - 3 * MS_PER_DAY),
      entitlementExpiresAt: new Date(
        Date.now() - (ENTITLEMENT_GRACE_HOURS + 1) * MS_PER_HOUR,
      ),
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    // Persisted as free, not merely recomputed as free on every read.
    expect(usage?.tier).toBe("free");
    // And the ordinary free path took over with no separate downgrade branch:
    // fresh period, counter zeroed, reset date back in the future.
    expect(usage?.tokensUsed).toBe(0);
    expect(usage?.periodEnd.toMillis()).toBeGreaterThan(Date.now());
  });

  it("treats a paid document with no entitlement at all as free", async () => {
    // Corrupt state — syncCustomer writes tier and entitlement in one set, so
    // one without the other should not exist. Failing closed hands the user
    // the FREE allowance rather than freezing them on a paid cap forever.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      periodEnd: new Date(Date.now() - MS_PER_DAY),
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage?.tier).toBe("free");
    expect(usage?.tokensUsed).toBe(0);
  });

  it("never pushes a refilled period past the entitlement", async () => {
    // The tail of a subscription: a 30-day slice would overshoot the three
    // days of access that remain. The allowance clock must not outlive the
    // access clock — that conflation is the whole reason these are two fields.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    const entitlementExpiresAt = new Date(Date.now() + 3 * MS_PER_DAY);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      periodEnd: new Date(Date.now() - MS_PER_DAY),
      entitlementExpiresAt,
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage?.tokensUsed).toBe(0);
    expect(usage?.periodEnd.toMillis()).toBe(entitlementExpiresAt.getTime());
  });

  it("leaves a healthy monthly subscriber's allowance alone", async () => {
    // The regression. A monthly plan's allowance window IS its billing window,
    // so periodEnd and entitlementExpiresAt are the same instant and the timer
    // can never fire while the entitlement is valid. A flat 30-day paid period
    // would have ended a day early, refilled here, and let the RENEWAL webhook
    // refill again the next day — two full allowances every month.
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);

    const renewsAt = new Date(Date.now() + MS_PER_DAY);

    await seedUsage(uid, {
      tier: "pro",
      tokensUsed: 1_000_000,
      periodEnd: renewsAt,
      entitlementExpiresAt: renewsAt,
    });

    await callUsagePercentage();

    const usage = await readUsage(uid);
    expect(usage?.tokensUsed).toBe(1_000_000);
    expect(usage?.periodEnd.toMillis()).toBe(renewsAt.getTime());
  });
});

/**
 * What the Settings plan card is told. Paid details are sent only while the
 * caller is paid RIGHT NOW, so the card can never advertise a plan the server
 * has stopped honouring, or an "active until" date already in the past.
 */
describe("plan details in the usage response", () => {
  const HOUR = 60 * 60 * 1000;

  interface PlanResponse {
    data: {
      tier: string;
      activeUntil: string | null;
      billingPeriod: string | null;
    };
  }

  beforeEach(async () => {
    await clearUsage();
  });

  it("sends the expiry and period for an active paid user", async () => {
    const { uid } = await createTestUser();
    const expiresAt = activeEntitlement();
    await seedUsage(uid, {
      tier: "pro",
      entitlementExpiresAt: expiresAt,
      productId: "hercule_pro_yearly",
    });

    const result = (await callUsagePercentage()) as PlanResponse;

    expect(result.data).toMatchObject({
      tier: "pro",
      activeUntil: expiresAt.toISOString(),
      billingPeriod: "yearly",
    });
  });

  it("sends nulls for a free user", async () => {
    await createTestUser();

    const result = (await callUsagePercentage()) as PlanResponse;

    expect(result.data).toMatchObject({
      tier: "free",
      activeUntil: null,
      billingPeriod: null,
    });
  });

  it("keeps the plan but drops a past expiry inside the grace", async () => {
    const { uid } = await createTestUser();
    await seedUsage(uid, {
      tier: "pro",
      entitlementExpiresAt: new Date(Date.now() - HOUR),
      productId: "hercule_pro_yearly",
    });

    const result = (await callUsagePercentage()) as PlanResponse;

    expect(result.data).toMatchObject({
      tier: "pro",
      activeUntil: null,
      billingPeriod: "yearly",
    });
  });

  it("sends nulls for a subscriber lapsed past the grace", async () => {
    const { uid } = await createTestUser();
    await seedUsage(uid, {
      tier: "pro",
      entitlementExpiresAt: new Date(
        Date.now() - (ENTITLEMENT_GRACE_HOURS + 1) * HOUR,
      ),
      productId: "hercule_pro_yearly",
    });

    const result = (await callUsagePercentage()) as PlanResponse;

    expect(result.data).toMatchObject({
      tier: "free",
      activeUntil: null,
      billingPeriod: null,
    });
  });
});
