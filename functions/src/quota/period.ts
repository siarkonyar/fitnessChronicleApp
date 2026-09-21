/**
 * When a usage period ends, and who is allowed to move it.
 *
 * Deliberately knows nothing about Firestore, for the same reason bucket.ts
 * doesn't: the rule below is a billing-safety property, and a property that
 * important should be provable by tests that run in milliseconds.
 *
 * THE RULE, in one line: a free period renews itself, a paid period is only
 * ever renewed by RevenueCat.
 */
import type { Tier } from "./caps.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Length of a free tier's usage period.
 *
 * A flat interval rather than a calendar month, and the difference matters.
 * Calendar arithmetic has to answer "what is 31 January plus one month", and
 * every answer either drifts the user's renewal day earlier each short month
 * or requires keeping their original signup day around forever just to undo
 * that drift. 30 days has no such edge: every date plus 30 days exists.
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
 * Decides whether this caller's allowance should roll over.
 *
 * `periodEndMs` is undefined for a document that has never had a period — a
 * brand-new user, or one created before this field existed.
 *
 * PAID TIERS NEVER SELF-RENEW. Only RevenueCat knows whether a subscription
 * was actually charged again, so renewing a paid period on a timer would hand
 * a free paid month to anyone whose webhook arrives late, gets retried, or is
 * dropped. An expired paid period therefore does nothing at all and waits:
 * the webhook is what moves periodEnd and zeroes the counter.
 *
 * Note this deliberately does NOT downgrade an expired paid user to free
 * either. RevenueCat retries webhooks, and demoting someone mid-retry would
 * punish a paying customer for our delivery problem. Their allowance simply
 * stops growing until a webhook settles the question.
 */
export const decidePeriod = (
  tier: Tier,
  periodEndMs: number | undefined,
  nowMs: number,
): PeriodDecision => {
  if (tier !== "free") return UNCHANGED;

  // Inclusive: at periodEnd the period is over, not ending. Exclusive would
  // leave a spent user one millisecond of a period they cannot spend in.
  const isOver = periodEndMs === undefined || nowMs >= periodEndMs;

  if (!isOver) return UNCHANGED;

  // Counted from now, NOT chained from the end that was missed. A user who
  // ignores the coach for six months would otherwise be handed a window that
  // expired months ago, and roll it again on their very next call.
  return { shouldReset: true, nextPeriodEnd: freePeriodEnd(nowMs) };
};
