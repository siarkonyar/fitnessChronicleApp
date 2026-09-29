/**
 * When a usage period ends, and who is allowed to move it.
 *
 * Deliberately knows nothing about Firestore, for the same reason bucket.ts
 * doesn't: the rules below are billing-safety properties, and properties that
 * important should be provable by tests that run in milliseconds.
 *
 * TWO CLOCKS, NOT ONE. This module used to track a single date, which quietly
 * meant two different things:
 *
 *   periodEnd            — when your TOKENS refill.   May move on a timer.
 *   entitlementExpiresAt — when your ACCESS runs out. Only RevenueCat moves it.
 *
 * THE RULE, in one line: a timer may refill tokens inside a window RevenueCat
 * has already confirmed was paid for, and may never extend the window itself.
 *
 * IN PRACTICE THIS TIMER ONLY EVER SERVES ANNUAL PLANS. A monthly subscriber's
 * two clocks end on the same instant, so the expiry guard below fires before
 * the refill can, and their allowance is reset solely by the RENEWAL webhook.
 * That is not a special case in the code — it falls out of the ordering.
 *
 * ALL CALENDAR ARITHMETIC HERE IS UTC. Firestore stores instants, and a reset
 * day defined in "the user's timezone" would move when they travel. The app
 * renders the instant locally; only the arithmetic is UTC.
 */
import type { Tier } from "./caps.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Length of a FREE tier's usage period.
 *
 * A flat interval rather than a calendar month, and the difference matters.
 * Calendar arithmetic has to answer "what is 31 January plus one month", and
 * every answer either drifts the user's renewal day earlier each short month
 * or requires keeping their original signup day around forever just to undo
 * that drift. 30 days has no such edge: every date plus 30 days exists.
 *
 * DO NOT REUSE THIS FOR A PAID TIER. It is safe here precisely because a free
 * user has no billing date to drift against. A paid user does, and 30 days is
 * shorter than every calendar month except February — so a 30-day paid period
 * would always end a day or two BEFORE the store's renewal, the timer would
 * refill the allowance, and the RENEWAL webhook would refill it again hours
 * later. Two full allowances per month, forever. Paid periods land on calendar
 * anniversaries instead — see nextMonthlyAnniversary.
 */
export const FREE_PERIOD_DAYS = 30;

/** The moment a free period opened at `nowMs` runs out. */
export const freePeriodEnd = (nowMs: number): number =>
  nowMs + FREE_PERIOD_DAYS * MS_PER_DAY;

/**
 * A union rather than a plain object so the two fields cannot disagree.
 * `shouldReset: true` guarantees a periodEnd to write, which spares every
 * caller a non-null assertion on a value that is always there.
 */
export type PeriodDecision =
  | { shouldReset: true; nextPeriodEnd: number }
  | { shouldReset: false; nextPeriodEnd: null };

/** Nothing happens. Shared so every refusal below is literally the same answer. */
const UNCHANGED: PeriodDecision = {
  shouldReset: false,
  nextPeriodEnd: null,
};

/**
 * Everything the decision depends on, as one object.
 *
 * An object rather than positional arguments because three of these are
 * `number | undefined` and transposing two of them at a call site would be
 * both invisible and a billing bug. Every field is REQUIRED even though three
 * of them are routinely `undefined` — that way forgetting to pass the
 * entitlement to a security-critical function is a compile error rather than
 * a free month.
 */
export interface PeriodInputs {
  tier: Tier;
  /** When the current allowance period ends. Undefined on a fresh document. */
  periodEndMs: number | undefined;
  /**
   * When paid access runs out. Undefined for free users, and never written by
   * us — RevenueCat owns it.
   *
   * Doubles as the anchor for a paid user's monthly reset day: an annual plan
   * bought on the 31st expires on the 31st, so its day-of-month is the day
   * their allowance refills. That is why no separate anchor field exists.
   */
  entitlementExpiresAtMs: number | undefined;
  nowMs: number;
}

/** Last day of a UTC month. Day 0 of the next month IS the last of this one. */
const daysInUtcMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * The anniversary of `anchor` falling in one given UTC month.
 *
 * Clamped to the month's last day, which is the whole reason this is not
 * `setUTCMonth(+1)`: that overflows 31 January into 3 March rather than
 * landing on the 28th.
 */
const anniversaryIn = (year: number, month: number, anchor: Date): number =>
  Date.UTC(
    year,
    month,
    Math.min(anchor.getUTCDate(), daysInUtcMonth(year, month)),
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  );

/**
 * The first monthly anniversary of `anchorMs` strictly after `afterMs`.
 *
 * ALWAYS MEASURED FROM THE ANCHOR, never from the previous period end. That is
 * what keeps a subscriber who started on the 31st landing back on the 31st:
 *
 *   31 Mar → 30 Apr → 31 May → 30 Jun → 31 Jul …
 *
 * Chaining month-by-month from the previous value instead would turn April's
 * clamp into a permanent one — 30 Apr → 30 May → 30 Jun — and the reset day
 * would walk backwards away from the day the store actually bills on.
 *
 * Two candidates suffice. If this month's anniversary has already passed,
 * next month's is at least 28 days later and therefore cannot have.
 */
const nextMonthlyAnniversary = (anchorMs: number, afterMs: number): number => {
  const anchor = new Date(anchorMs);
  const after = new Date(afterMs);
  const year = after.getUTCFullYear();
  const month = after.getUTCMonth();

  const thisMonth = anniversaryIn(year, month, anchor);
  if (thisMonth > afterMs) return thisMonth;

  // Month 12 rolls into January of the next year; Date.UTC normalises it.
  return anniversaryIn(year, month + 1, anchor);
};

/**
 * Where a paid allowance period that starts at `nowMs` ends.
 *
 * The next monthly anniversary of the expiry, clamped to the expiry itself.
 * For a monthly plan those are the same instant, so the period simply ends
 * when access does and the next payment resets it. For an annual plan it is
 * one month in, on the expiry's day of the month.
 *
 * The clamp is what keeps the allowance clock from ever outliving the access
 * clock — the exact confusion that splitting these two fields exists to
 * remove. It also covers the short last month of a subscription, and access
 * that only runs for days (a store's billing grace window).
 *
 * Shared by the RevenueCat trigger, which opens a subscriber's FIRST period,
 * and by decidePaidPeriod below, which rolls an annual one on. One rule, so
 * the two can never disagree about where a paid month ends.
 */
export const nextPaidPeriodEnd = (
  entitlementExpiresAtMs: number,
  nowMs: number,
): number =>
  Math.min(
    nextMonthlyAnniversary(entitlementExpiresAtMs, nowMs),
    entitlementExpiresAtMs,
  );

/**
 * A free period renews itself, from NOW.
 *
 * Counted from now, NOT chained from the end that was missed. A user who
 * ignores the coach for six months would otherwise be handed a window that
 * expired months ago, and roll it again on their very next call. The paid
 * branch chains deliberately — see below for why the two differ.
 */
const decideFreePeriod = (
  periodEndMs: number | undefined,
  nowMs: number,
): PeriodDecision => {
  // Inclusive: at periodEnd the period is over, not ending. Exclusive would
  // leave a spent user one millisecond of a period they cannot spend in.
  const isOver = periodEndMs === undefined || nowMs >= periodEndMs;

  if (!isOver) return UNCHANGED;

  return { shouldReset: true, nextPeriodEnd: freePeriodEnd(nowMs) };
};

/**
 * A paid period refills only inside a window RevenueCat has vouched for.
 *
 * WHY A PAID TIMER EXISTS AT ALL. A monthly subscriber never needs one: their
 * RENEWAL webhook arrives every month and resets the counter itself, and their
 * two clocks end together so the expiry guard below refuses before the refill
 * is ever reached. An annual subscriber hears nothing from RevenueCat for a
 * year, and a single allowance stretched across twelve months is not a
 * subscription anyone would keep. This walks them month by month instead.
 *
 * WHY THAT IS NOT THE THING period.ts EXISTS TO PREVENT. It never moves
 * `entitlementExpiresAt`. RevenueCat already told us this person is entitled
 * until that instant; handing them next month's tokens inside it grants
 * nothing that was not paid for. Extending the window on a timer is what would
 * hand out free paid months, and nothing here can do that.
 *
 * NOTE THIS DOES NOT DOWNGRADE AN EXPIRED PAID USER EITHER. RevenueCat retries
 * webhooks, and demoting someone mid-retry would punish a paying customer for
 * our delivery problem. Their allowance simply stops refilling until a webhook
 * settles the question.
 *
 * THAT WAIT IS BOUNDED, BUT NOT HERE. effectiveTier in entitlement.ts resolves
 * a paid tier whose entitlement lapsed more than ENTITLEMENT_GRACE_HOURS ago
 * down to "free" BEFORE decidePeriod is ever called — quota/check.ts runs the
 * two in that order. So a lost EXPIRATION cannot strand anyone in this branch
 * forever: they arrive as the free user they now are, and decideFreePeriod
 * opens them a fresh period. This module deliberately knows nothing about
 * that, and should stay that way.
 */
const decidePaidPeriod = (
  periodEndMs: number | undefined,
  entitlementExpiresAtMs: number | undefined,
  nowMs: number,
): PeriodDecision => {
  // No entitlement on a paid document is corrupt state: the webhook writes the
  // tier and the entitlement together. Refusing keeps a bad write from
  // becoming free allowance.
  if (entitlementExpiresAtMs === undefined) return UNCHANGED;

  // Outside the paid window. THE security property — see the comment above.
  if (nowMs >= entitlementExpiresAtMs) return UNCHANGED;

  // Corrupt in the other direction, and refused for the same reason.
  if (periodEndMs === undefined) return UNCHANGED;

  // The current period is still running. This is the branch a healthy monthly
  // subscriber sits in for their whole billing month.
  if (nowMs < periodEndMs) return UNCHANGED;

  // Measured from NOW, not from the period end that was missed, so an annual
  // subscriber returning after three quiet months lands on the next real
  // anniversary rather than one still in the past — which would roll again on
  // their very next request, zeroing the counter over and over. Safe to
  // return: the expiry is known to be in the future by the guard above.
  return {
    shouldReset: true,
    nextPeriodEnd: nextPaidPeriodEnd(entitlementExpiresAtMs, nowMs),
  };
};

/**
 * Decides whether this caller's allowance should roll over.
 *
 * Free and paid are genuinely different rules, not one rule with a flag, so
 * they are two functions and this only picks between them.
 */
export const decidePeriod = ({
  tier,
  periodEndMs,
  entitlementExpiresAtMs,
  nowMs,
}: PeriodInputs): PeriodDecision =>
  tier === "free"
    ? // The entitlement is ignored outright rather than consulted. A churned
      // user keeps whatever the webhook last wrote, and a dead entitlement
      // must not be able to hold a free user's allowance hostage.
      decideFreePeriod(periodEndMs, nowMs)
    : decidePaidPeriod(periodEndMs, entitlementExpiresAtMs, nowMs);
