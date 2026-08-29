/**
 * How many tokens a user may spend on the coach per period.
 *
 * The unit is TOTAL tokens, which on gemini-3.6-flash includes thinking
 * tokens. Measured at step 3, reasoning was 93-97% of every call — a one-line
 * "tell me a joke" cost 479 to 1151 total against 33 of input plus output.
 * Metering input + output would undercount roughly 35-fold, so a cap expressed
 * against that number would be meaningless.
 */

/** Free tier allowance per period. */
export const FREE_TOKEN_CAP = 0;

/** Paid tier allowance per period. */
export const PREMIUM_TOKEN_CAP = 3_000_000;

/**
 * Refuse a turn when fewer than this many tokens remain.
 *
 * The budget is checked before the call but the cost is only known after, so
 * without headroom a user sitting on 10 remaining tokens could still start a
 * turn that spends 20,000. Sized above the most expensive turn observed, with
 * room to spare: tool-using turns cost far more than plain ones, and the same
 * prompt varied 2.5x between runs, so this cannot be tuned tightly.
 */
export const MIN_HEADROOM_TOKENS = 25_000;

/** Length of a usage period, counted from periodStart. */
export const PERIOD_DAYS = 30;

export type Tier = "free" | "premium";

export const capForTier = (tier: Tier): number =>
  tier === "premium" ? PREMIUM_TOKEN_CAP : FREE_TOKEN_CAP;
