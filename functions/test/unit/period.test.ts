import { describe, expect, it } from "vitest";
import type { Tier } from "../../src/quota/caps.js";
import {
  FREE_PERIOD_DAYS,
  decidePeriod,
  freePeriodEnd,
  nextPaidPeriodEnd,
} from "../../src/quota/period.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 2, 14, 12, 0, 0);

/**
 * The dates from the monthly-subscriber example that found the double-refill
 * bug. Spelled as real calendar days because the whole point is that a
 * calendar month is NOT 30 days.
 */
const JAN_15 = Date.UTC(2026, 0, 15);
const FEB_14 = Date.UTC(2026, 1, 14);
const FEB_15 = Date.UTC(2026, 1, 15);

/** Readable failure messages: 1775001600000 tells nobody anything. */
const day = (ms: number | null): string =>
  ms === null ? "none" : new Date(ms).toISOString().slice(0, 10);

/** Free documents carry no entitlement. Spelled once, here. */
const decideFree = (periodEndMs: number | undefined, nowMs: number) =>
  decidePeriod({
    tier: "free",
    periodEndMs,
    entitlementExpiresAtMs: undefined,
    nowMs,
  });

interface PaidFields {
  periodEndMs?: number;
  entitlementExpiresAtMs?: number;
}

const decidePaid = (tier: Tier, fields: PaidFields, nowMs: number) =>
  decidePeriod({
    tier,
    periodEndMs: fields.periodEndMs,
    entitlementExpiresAtMs: fields.entitlementExpiresAtMs,
    nowMs,
  });

const PAID_TIERS = ["pro", "max"] as const;

describe("freePeriodEnd", () => {
  it("lands exactly FREE_PERIOD_DAYS after the given moment", () => {
    expect(freePeriodEnd(NOW)).toBe(NOW + FREE_PERIOD_DAYS * MS_PER_DAY);
  });

  it("is a flat 30 days, not a calendar month", () => {
    // Deliberately NOT calendar arithmetic, and deliberately FREE-ONLY. A free
    // user has no billing date to drift against, so a fixed interval costs
    // nothing and avoids the "31 January plus one month" question entirely.
    // A PAID user does have one, which is why the paid branch below does the
    // calendar arithmetic properly rather than reusing this.
    expect(FREE_PERIOD_DAYS).toBe(30);
  });
});

/**
 * Where a paid allowance's next reset lands. The RevenueCat trigger calls this
 * to open a subscriber's FIRST period; decidePeriod calls it to roll an annual
 * one on. One rule, so the two can never disagree.
 */
describe("nextPaidPeriodEnd", () => {
  it("ends a monthly subscriber's period at their expiry", () => {
    // Bought Oct 14, renews Nov 14. The RENEWAL resets them, not a timer.
    const bought = Date.UTC(2026, 9, 14, 12, 0, 0);
    const expires = Date.UTC(2026, 10, 14, 12, 0, 0);

    expect(day(nextPaidPeriodEnd(expires, bought))).toBe("2026-11-14");
  });

  it("ends an annual subscriber's first period one month in", () => {
    const bought = Date.UTC(2026, 9, 14, 12, 0, 0);
    const expires = Date.UTC(2027, 9, 14, 12, 0, 0);

    expect(day(nextPaidPeriodEnd(expires, bought))).toBe("2026-11-14");
  });

  it("lands an annual plan bought on the 31st on a short month's last day", () => {
    const bought = Date.UTC(2026, 0, 31, 10, 0, 0);
    const expires = Date.UTC(2027, 0, 31, 10, 0, 0);

    expect(day(nextPaidPeriodEnd(expires, bought))).toBe("2026-02-28");
  });

  it("never outlives the expiry", () => {
    // Access that ends in six days (a billing grace window, say) cannot carry
    // an allowance period that runs for a month.
    const now = Date.UTC(2026, 9, 14, 12, 0, 0);
    const expires = Date.UTC(2026, 9, 20, 12, 0, 0);

    expect(nextPaidPeriodEnd(expires, now)).toBe(expires);
  });
});

describe("decidePeriod — free tier", () => {
  it("opens a period when the document has none yet", () => {
    expect(decideFree(undefined, NOW)).toEqual({
      shouldReset: true,
      nextPeriodEnd: freePeriodEnd(NOW),
    });
  });

  it("leaves a period that is still running alone", () => {
    expect(decideFree(NOW + MS_PER_DAY, NOW)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });

  it("rolls over once the end has passed", () => {
    expect(decideFree(NOW - MS_PER_DAY, NOW)).toEqual({
      shouldReset: true,
      nextPeriodEnd: freePeriodEnd(NOW),
    });
  });

  it("rolls over at the exact millisecond the period ends", () => {
    // The boundary is inclusive: at periodEnd the period is over, not ending.
    // Exclusive would leave a spent user one millisecond of a period they
    // cannot spend in.
    expect(decideFree(NOW, NOW).shouldReset).toBe(true);
  });

  it("counts the new period from now, not from the end it missed", () => {
    // Chaining from the old end would hand a returning user a window that
    // expired months ago, and roll it again on their very next call.
    expect(decideFree(NOW - 200 * MS_PER_DAY, NOW).nextPeriodEnd).toBe(
      freePeriodEnd(NOW),
    );
  });

  it("ignores an entitlement left behind on a downgraded document", () => {
    // A churned user keeps whatever the webhook last wrote. Once the tier is
    // free again that date is noise, and a dead entitlement must not be able
    // to hold a free user's allowance hostage.
    const decision = decidePeriod({
      tier: "free",
      periodEndMs: NOW - MS_PER_DAY,
      entitlementExpiresAtMs: NOW - 90 * MS_PER_DAY,
      nowMs: NOW,
    });

    expect(decision).toEqual({
      shouldReset: true,
      nextPeriodEnd: freePeriodEnd(NOW),
    });
  });
});

describe("decidePeriod — paid tiers, refusals", () => {
  it.each(PAID_TIERS)(
    "does not invent a period for a %s document with no entitlement date",
    (tier) => {
      // Corrupt state: the webhook writes the tier and the entitlement
      // together. Refusing keeps a bad write from becoming free allowance.
      expect(decidePaid(tier, { periodEndMs: NOW - MS_PER_DAY }, NOW)).toEqual({
        shouldReset: false,
        nextPeriodEnd: null,
      });
    },
  );

  it.each(PAID_TIERS)(
    "never refills a %s allowance once the entitlement has expired",
    (tier) => {
      // THE security property. Only RevenueCat knows whether a subscription
      // was actually charged again, so refilling outside a window RevenueCat
      // confirmed was paid for is a free paid month for anyone whose webhook
      // is late, retried, or dropped.
      expect(
        decidePaid(
          tier,
          {
            periodEndMs: NOW - 8 * MS_PER_DAY,
            entitlementExpiresAtMs: NOW - 7 * MS_PER_DAY,
          },
          NOW,
        ),
      ).toEqual({ shouldReset: false, nextPeriodEnd: null });
    },
  );

  it.each(PAID_TIERS)("leaves a running %s period alone", (tier) => {
    expect(
      decidePaid(
        tier,
        {
          periodEndMs: NOW + 7 * MS_PER_DAY,
          entitlementExpiresAtMs: NOW + 300 * MS_PER_DAY,
        },
        NOW,
      ),
    ).toEqual({ shouldReset: false, nextPeriodEnd: null });
  });

  it.each(PAID_TIERS)(
    "does not refill a %s document with no period end",
    (tier) => {
      expect(
        decidePaid(
          tier,
          { entitlementExpiresAtMs: NOW + 300 * MS_PER_DAY },
          NOW,
        ),
      ).toEqual({ shouldReset: false, nextPeriodEnd: null });
    },
  );
});

/**
 * An annual subscriber who started on 31 March 2026.
 *
 * The store bills them again on 31 March 2027, so that is the entitlement —
 * and its day-of-month, the 31st, is the anchor their allowance refills on.
 */
const ANNUAL_EXPIRY = Date.UTC(2027, 2, 31);

describe("decidePeriod — an annual allowance walks the calendar", () => {
  it.each(PAID_TIERS)(
    "refills a %s allowance when the month is over but the entitlement is not",
    (tier) => {
      // The annual case, and the only reason a paid timer exists at all.
      // RevenueCat has already confirmed this window was paid for, so handing
      // over the next month's tokens inside it grants nothing unpaid.
      const decision = decidePaid(
        tier,
        {
          periodEndMs: Date.UTC(2026, 3, 30),
          entitlementExpiresAtMs: ANNUAL_EXPIRY,
        },
        Date.UTC(2026, 3, 30),
      );

      expect(decision.shouldReset).toBe(true);
      expect(day(decision.nextPeriodEnd)).toBe("2026-05-31");
    },
  );

  it("returns to the 31st after a short month clamps it to the 30th", () => {
    // THE anchoring property. April has no 31st so that month ends on the
    // 30th, but May does — and the anchor, not the clamped value, is what the
    // next boundary is measured from. Chaining from 30 April instead would
    // make the clamp permanent and walk the reset day backwards all year.
    const walk: string[] = [];
    let periodEndMs = Date.UTC(2026, 3, 30); // 30 April 2026

    // Step the clock to each boundary in turn, exactly as a user opening the
    // app on their reset day would.
    for (let i = 0; i < 11; i += 1) {
      const decision = decidePaid(
        "pro",
        { periodEndMs, entitlementExpiresAtMs: ANNUAL_EXPIRY },
        periodEndMs,
      );

      expect(decision.shouldReset).toBe(true);
      periodEndMs = decision.nextPeriodEnd!;
      walk.push(day(periodEndMs));
    }

    expect(walk).toEqual([
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      // The twelfth boundary IS the renewal date. From here the entitlement
      // is expired and only the webhook can move anything.
      "2027-03-31",
    ]);
  });

  it("stops at the renewal date and waits for the webhook", () => {
    // Standing exactly on the expiry. Both clocks are up together, and the
    // expiry guard refuses before any refill is considered.
    expect(
      decidePaid(
        "pro",
        { periodEndMs: ANNUAL_EXPIRY, entitlementExpiresAtMs: ANNUAL_EXPIRY },
        ANNUAL_EXPIRY,
      ),
    ).toEqual({ shouldReset: false, nextPeriodEnd: null });
  });

  it("lands on 29 February in a leap year", () => {
    // 2028 is a leap year, so an anchor of the 31st clamps to the 29th rather
    // than the 28th. Pinned because it is the one clamp a hand-rolled
    // "subtract a day" rule would get wrong.
    const decision = decidePaid(
      "pro",
      {
        periodEndMs: Date.UTC(2028, 0, 31),
        entitlementExpiresAtMs: Date.UTC(2029, 0, 31),
      },
      Date.UTC(2028, 0, 31),
    );

    expect(day(decision.nextPeriodEnd)).toBe("2028-02-29");
  });

  it("catches up to the next real anniversary after a long absence", () => {
    // An annual subscriber who ignores the coach from May until September.
    // Landing on a boundary still in the past would roll again on their very
    // next request, zeroing the counter over and over.
    const decision = decidePaid(
      "pro",
      {
        periodEndMs: Date.UTC(2026, 4, 31),
        entitlementExpiresAtMs: ANNUAL_EXPIRY,
      },
      Date.UTC(2026, 8, 12),
    );

    expect(decision.shouldReset).toBe(true);
    expect(day(decision.nextPeriodEnd)).toBe("2026-09-30");
  });

  it("never pushes a refilled period past the entitlement", () => {
    // The last month of a subscription is short. The allowance clock must not
    // outlive the access clock — that conflation is the whole reason these
    // are two separate fields.
    const decision = decidePaid(
      "pro",
      {
        periodEndMs: Date.UTC(2027, 1, 28),
        entitlementExpiresAtMs: ANNUAL_EXPIRY,
      },
      Date.UTC(2027, 1, 28),
    );

    expect(decision.nextPeriodEnd).toBe(ANNUAL_EXPIRY);
  });
});

describe("decidePeriod — a monthly subscriber is never touched by the timer", () => {
  /**
   * The regression this module's shape exists for.
   *
   * Someone subscribes on 15 January; the store renews them on 15 February.
   * A flat 30-day allowance would have ended on 14 February — one day EARLY —
   * so the timer would refill, and the RENEWAL webhook would refill again the
   * next day. Two full allowances every month, forever.
   *
   * A monthly plan's allowance window IS its billing window, so both dates are
   * the same instant and the expiry guard always wins. No special case in the
   * code: monthly is RevenueCat's alone, and that falls out of the ordering.
   */
  const monthly = {
    periodEndMs: FEB_15,
    entitlementExpiresAtMs: FEB_15,
  };

  it("does not refill on day 30, the day before the store renews", () => {
    expect(decidePaid("pro", monthly, FEB_14)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });

  it("does not refill at the renewal instant either — that is the webhook's job", () => {
    expect(decidePaid("pro", monthly, FEB_15)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });

  it("does not refill even if the renewal webhook is days late", () => {
    expect(decidePaid("pro", monthly, FEB_15 + 3 * MS_PER_DAY)).toEqual({
      shouldReset: false,
      nextPeriodEnd: null,
    });
  });

  it("proves a calendar month is longer than the free tier's 30 days", () => {
    // The arithmetic behind the bug, pinned so nobody "simplifies" the paid
    // branch back onto FREE_PERIOD_DAYS.
    expect(FEB_15 - JAN_15).toBeGreaterThan(FREE_PERIOD_DAYS * MS_PER_DAY);
  });
});
