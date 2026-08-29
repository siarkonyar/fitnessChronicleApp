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

/**
 * How many turns a user may fire back-to-back before the drip rate takes over.
 *
 * This is the BURST allowance, not the rate. A real user genuinely does send a
 * few messages in a row — asking a follow-up, correcting a typo, retrying after
 * a bad reply — and refusing that would read as the app being broken. Five is
 * comfortably above what a person does by hand and far below what a script does.
 */
export const BUCKET_CAPACITY = 5;

/**
 * How long one turn's allowance takes to come back.
 *
 * 60_000 / 5 = 12_000, so once the burst is spent the sustained ceiling is
 * five turns per minute, forever. The division is written out because "12
 * seconds" on its own tells you nothing about where it came from.
 *
 * That ceiling is what makes the token cap hard to drain: at five turns a
 * minute, a script would need days to burn a premium allowance, not minutes.
 */
export const REFILL_INTERVAL_MS = 12_000;

export const capForTier = (tier: Tier): number =>
  tier === "premium" ? PREMIUM_TOKEN_CAP : FREE_TOKEN_CAP;
