import { describe, expect, it } from "vitest";
import {
  FREE_PERIOD_DAYS,
  decidePeriod,
  freePeriodEnd,
} from "../../src/quota/period.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 2, 14, 12, 0, 0);

/**
 * When a usage period ends, and who is allowed to say so.
 *
 * Pure arithmetic with an injected clock, for the same reason bucket.ts is:
 * the tier-dependent half of this is a security property — a paid period that
 * renews itself hands out free paid months — and a property that important
 * deserves tests that run in milliseconds rather than an emulator.
 */
describe("freePeriodEnd", () => {
  it("lands exactly FREE_PERIOD_DAYS after the given moment", () => {
    expect(freePeriodEnd(NOW)).toBe(NOW + FREE_PERIOD_DAYS * MS_PER_DAY);
  });

  it("is a flat 30 days, not a calendar month", () => {
    // Deliberately NOT calendar arithmetic. A month-based anniversary has to
    // answer "what is 31 January plus one month", and every answer to that
    // either drifts a user's renewal day earlier and earlier or needs their
    // original signup day kept around forever. A fixed interval has no such
    // edge case: every date plus 30 days exists.
    expect(FREE_PERIOD_DAYS).toBe(30);
  });
});

describe("decidePeriod — free tier", () => {
  it("opens a period when the document has none yet", () => {
    // The state a brand-new user is in. Their first period starts now.
    expect(decidePeriod("free", undefined, NOW)).toEqual({
      shouldReset: true,
      nextPeriodEnd: freePeriodEnd(NOW),
    });
  });

  it("leaves a period that is still running alone", () => {
    const endsTomorrow = NOW + MS_PER_DAY;

    expect(decidePeriod("free", endsTomorrow, NOW)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });

  it("rolls over once the end has passed", () => {
    const endedYesterday = NOW - MS_PER_DAY;

    expect(decidePeriod("free", endedYesterday, NOW)).toEqual({
      shouldReset: true,
      nextPeriodEnd: freePeriodEnd(NOW),
    });
  });

  it("rolls over at the exact millisecond the period ends", () => {
    // The boundary is inclusive: at periodEnd the period is over, not ending.
    // Exclusive would leave a user one millisecond of a period whose allowance
    // is already spent, which reads as the coach being broken.
    expect(decidePeriod("free", NOW, NOW).shouldReset).toBe(true);
  });

  it("counts the new period from now, not from the end it missed", () => {
    // A user who ignores the coach for six months gets a period starting
    // today, not a stale window that expired months ago. Chaining from the old
    // end would hand them an already-expired period and roll it again on the
    // very next call.
    const endedLongAgo = NOW - 200 * MS_PER_DAY;

    expect(decidePeriod("free", endedLongAgo, NOW).nextPeriodEnd).toBe(
      freePeriodEnd(NOW),
    );
  });
});

describe("decidePeriod — paid tiers", () => {
  it.each(["pro", "max"] as const)(
    "never renews a %s period on its own, even long after it ended",
    (tier) => {
      const endedLastWeek = NOW - 7 * MS_PER_DAY;

      // THE security property of this module. Only RevenueCat knows whether a
      // subscription was actually paid for again, so a paid period that
      // self-renews on a timer is a free paid month for anyone whose webhook
      // is late, retried, or dropped. Nothing happens here — the webhook is
      // what moves periodEnd and zeroes the counter.
      expect(decidePeriod(tier, endedLastWeek, NOW)).toEqual({
        shouldReset: false,
        nextPeriodEnd: null,
      });
    },
  );

  it.each(["pro", "max"] as const)(
    "does not invent a period for a %s document that has none",
    (tier) => {
      // Corrupt state: the webhook writes tier and periodEnd together, so one
      // without the other should not exist. Granting a fresh period here would
      // turn a bad write into free allowance, so it gets the same refusal.
      expect(decidePeriod(tier, undefined, NOW)).toEqual({
        shouldReset: false,
        nextPeriodEnd: null,
      });
    },
  );

  it.each(["pro", "max"] as const)("leaves a running %s period alone", (tier) => {
    const endsNextWeek = NOW + 7 * MS_PER_DAY;

    expect(decidePeriod(tier, endsNextWeek, NOW)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });
});
