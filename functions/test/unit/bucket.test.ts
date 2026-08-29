import { describe, expect, it } from "vitest";
import { refill, trySpend, type BucketState } from "../../src/quota/bucket.js";
import { BUCKET_CAPACITY, REFILL_INTERVAL_MS } from "../../src/quota/caps.js";

// The clock is injected, so "now" can be any number. Starting the epoch at 0
// keeps the arithmetic in every test readable at a glance.
const empty = (lastRefill = 0): BucketState => ({ tokens: 0, lastRefill });
const full = (lastRefill = 0): BucketState => ({
  tokens: BUCKET_CAPACITY,
  lastRefill,
});

describe("refill", () => {
  it("adds one token per elapsed interval", () => {
    const result = refill(empty(), REFILL_INTERVAL_MS);

    expect(result.tokens).toBe(1);
    expect(result.lastRefill).toBe(REFILL_INTERVAL_MS);
  });

  it("adds nothing before a full interval has elapsed", () => {
    const result = refill(empty(), REFILL_INTERVAL_MS - 1);

    expect(result.tokens).toBe(0);
    expect(result.lastRefill).toBe(0);
  });

  it("preserves the leftover milliseconds instead of discarding them", () => {
    // One interval plus 5s. One token is owed; the 5s is credit towards the
    // next one and must survive. If lastRefill jumped to nowMs, this test's
    // second call would come up a token short.
    const leftover = 5_000;
    const first = refill(empty(), REFILL_INTERVAL_MS + leftover);

    expect(first.tokens).toBe(1);
    expect(first.lastRefill).toBe(REFILL_INTERVAL_MS);

    // 7s later a second full interval has completed, so a second token is due
    // — even though only 7s passed since the previous call.
    const second = refill(first, REFILL_INTERVAL_MS * 2);

    expect(second.tokens).toBe(2);
  });

  it("clamps at capacity no matter how long the bucket sat idle", () => {
    const aVeryLongTime = REFILL_INTERVAL_MS * 1000;

    const result = refill(empty(), aVeryLongTime);

    expect(result.tokens).toBe(BUCKET_CAPACITY);
  });

  it("moves a full bucket's clock to now so idle time cannot be banked", () => {
    const aVeryLongTime = REFILL_INTERVAL_MS * 1000;

    const result = refill(full(), aVeryLongTime);

    // The assertion that matters. If lastRefill stayed at 0, the user could
    // spend all 5 tokens and instantly refill to 5 again off the banked time.
    expect(result.lastRefill).toBe(aVeryLongTime);
  });

  it("does not subtract tokens when the clock runs backwards", () => {
    const state: BucketState = { tokens: 2, lastRefill: 100_000 };

    const result = refill(state, 90_000);

    expect(result.tokens).toBe(2);
    expect(result.lastRefill).toBe(100_000);
  });
});

describe("trySpend", () => {
  it("takes exactly one token when the bucket has some", () => {
    const result = trySpend(full(), 0);

    expect(result.ok).toBe(true);
    expect(result.next.tokens).toBe(BUCKET_CAPACITY - 1);
  });

  it("refuses when the bucket is empty", () => {
    const result = trySpend(empty(), 0);

    expect(result.ok).toBe(false);
    expect(result.next.tokens).toBe(0);
  });

  it("allows exactly BUCKET_CAPACITY spends in an instant, then refuses", () => {
    // The burst guarantee, spelled out: with the clock frozen, no token can
    // refill, so the bucket's capacity is the whole allowance.
    let state = full();
    const frozenClock = 0;

    for (let i = 0; i < BUCKET_CAPACITY; i += 1) {
      const result = trySpend(state, frozenClock);
      expect(result.ok).toBe(true);
      state = result.next;
    }

    expect(trySpend(state, frozenClock).ok).toBe(false);
  });

  it("lets a drained bucket spend again after one interval", () => {
    const drained = empty();

    expect(trySpend(drained, REFILL_INTERVAL_MS - 1).ok).toBe(false);
    expect(trySpend(drained, REFILL_INTERVAL_MS).ok).toBe(true);
  });

  it("does not mutate the state it is given", () => {
    // check.ts relies on this: it reads the stored bucket, calls trySpend, and
    // on a refusal writes nothing at all. That is only safe while the input is
    // left untouched.
    const state = full();

    trySpend(state, REFILL_INTERVAL_MS);

    expect(state.tokens).toBe(BUCKET_CAPACITY);
    expect(state.lastRefill).toBe(0);
  });
});
