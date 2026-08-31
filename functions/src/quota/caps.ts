/**
 * How many tokens a user may spend on the coach per period.
 *
 * The unit is TOTAL tokens, which includes thinking tokens. That choice was
 * forced by measurement on gemini-3.6-flash at LOW thinking, where reasoning
 * ran to 93-97% of every call — a one-line "tell me a joke" cost 479 to 1151
 * total against 33 of input plus output. Metering input + output would have
 * undercounted roughly 35-fold.
 *
 * The coach has since moved to gemini-3.1-flash-lite at MINIMAL thinking, so
 * that 35-fold gap is now much smaller. Keep metering totals anyway: thinking
 * is billed as output either way, and a meter that silently stops counting the
 * expensive part the moment someone raises thinkingLevel is a trap.
 */

/**
 * Free tier allowance per period.
 *
 * Sized to buy three programs. Measured on gemini-3.1-flash-lite at MINIMAL
 * thinking, one whole program conversation — the questions plus the proposal —
 * costs at most 10,000 tokens.
 *
 * Note this is NOT the spendable amount. A turn is refused while a headroom's
 * worth still remains, so what a user can actually spend is
 * `cap - MIN_HEADROOM_TOKENS`:
 *
 *   40_000 cap - 5_000 headroom = 35_000 spendable = three programs, and change
 *
 * Three is the floor being bought here, not the exact figure — the spare 5_000
 * absorbs a program that runs long without dropping anyone to two. Raise the
 * headroom and this number has to rise with it, or the free tier quietly stops
 * being three programs.
 */
export const FREE_TOKEN_CAP = 40_000;

/** Paid tier allowance per period. */
export const PREMIUM_TOKEN_CAP = 3_000_000;

/**
 * Refuse a turn when fewer than this many tokens remain.
 *
 * The budget is checked before the call but the cost is only known after, so
 * without headroom a user sitting on 10 remaining tokens could still start a
 * turn that spends 20,000. This must therefore cover the most expensive single
 * TURN, not the most expensive conversation.
 *
 * 10,000 is the whole-conversation cost of building a program, so it is a
 * guaranteed-safe ceiling for one turn: a single turn cannot cost more than the
 * conversation that contains it. It is deliberately loose. Tightening it needs
 * per-turn measurements rather than per-program ones, and the win is small —
 * every token cut here has to be added back to FREE_TOKEN_CAP to keep three
 * programs, so the two move together and the user-visible allowance is
 * unchanged.
 *
 * The previous value, 25_000, was measured on gemini-3.6-flash at LOW thinking
 * where reasoning ran to 93-97% of every call. The coach now runs
 * gemini-3.1-flash-lite at MINIMAL, so that figure no longer describes anything.
 */
export const MIN_HEADROOM_TOKENS = 5_000;

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
