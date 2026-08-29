import { beforeEach, describe, expect, it } from "vitest";
import { BUCKET_CAPACITY, PREMIUM_TOKEN_CAP } from "../../src/quota/caps.js";
import {
  callCoach,
  catchCallableError,
  clearUsage,
  createTestUser,
  readUsage,
  seedUsage,
  validCoachRequest,
} from "./setup.js";

/**
 * The spam guard.
 *
 * Every case seeds the bucket by hand rather than sending real traffic. That
 * is deliberate: driving the bucket empty with genuine calls would mean
 * letting BUCKET_CAPACITY turns through to Gemini first, which costs money and
 * would make CI depend on a live model. Seeding proves the same thing — the
 * limiter is wired into the callable and rejects before the model — with no
 * call ever leaving the emulator.
 */
describe("rate limiting", () => {
  beforeEach(async () => {
    await clearUsage();
  });

  it("refuses a user whose bucket is empty, even with allowance to spare", async () => {
    const { uid } = await createTestUser();
    await seedUsage(uid, {
      // Plenty of allowance left, so nothing but the bucket can refuse this.
      tier: "premium",
      tokensUsed: 0,
      rateTokens: 0,
      // Recent, so no token refills between the seed and the call.
      rateLastRefill: Date.now(),
    });

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/resource-exhausted");
    expect(failure.details).toEqual({ reason: "rate_limit" });
  });

  it("writes nothing when it refuses", async () => {
    const { uid } = await createTestUser();
    const seededAt = Date.now();
    await seedUsage(uid, {
      tier: "premium",
      tokensUsed: 0,
      rateTokens: 0,
      rateLastRefill: seededAt,
    });

    await catchCallableError(() => callCoach(validCoachRequest()));

    // A flood hits this path over and over. One write per rejected request
    // would let the spammer set our Firestore bill, so the refusal path is
    // read-only — safe because refill() recomputes the same answer from the
    // stored state next time.
    const usage = await readUsage(uid);
    expect(usage?.rateTokens).toBe(0);
    expect(usage?.rateLastRefill).toBe(seededAt);
  });

  it("lets exactly BUCKET_CAPACITY concurrent turns through, and no more", async () => {
    const { uid } = await createTestUser();
    await seedUsage(uid, {
      tier: "premium",
      // Over quota on purpose. Every one of these turns is refused either way,
      // so none can reach Gemini — but the REASON tells us which gate stopped
      // it, and that is what this test reads.
      tokensUsed: PREMIUM_TOKEN_CAP,
      rateTokens: BUCKET_CAPACITY,
      rateLastRefill: Date.now(),
    });

    const attempts = BUCKET_CAPACITY + 1;
    const failures = await Promise.all(
      Array.from({ length: attempts }, () =>
        catchCallableError(() => callCoach(validCoachRequest())),
      ),
    );

    const reasons = failures.map(
      (failure) => (failure.details as { reason?: string } | undefined)?.reason,
    );

    // The assertion that matters most in this whole suite. It tests the
    // transaction's atomicity: five callers each got a token and passed the
    // limiter (falling through to the quota gate behind it), and the sixth
    // found the bucket empty. A read-then-write limiter would let all six
    // through here and still pass every other test in this file.
    expect(reasons.filter((reason) => reason === "quota")).toHaveLength(
      BUCKET_CAPACITY,
    );
    expect(reasons.filter((reason) => reason === "rate_limit")).toHaveLength(1);

    expect((await readUsage(uid))?.rateTokens).toBe(0);
  });
});
