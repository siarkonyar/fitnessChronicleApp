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

/**
 * Paid tier allowances per period.
 *
 * PROVISIONAL. Pricing for pro and max has not been decided, so these are
 * placeholders that must be set from the real per-user cost target before
 * either tier goes on sale. They are unreachable until the RevenueCat webhook
 * exists to write a paid tier onto a document, so a wrong number here cannot
 * affect anyone today — but it silently becomes real the moment it can.
 *
 * PRO inherits the figure the old single paid tier was measured at. MAX is a
 * guess whose only defensible property is being larger than PRO: a "max" tier
 * that allows no more than "pro" is a lie told by the tier's name.
 *
 * BOTH ARE KNOWN TO BE TOO EXPENSIVE TO SELL AS THEY STAND. 3,000,000 tokens
 * was measured at roughly $11 per user per month against a stated ceiling of
 * $4, and MAX is more than three times that again. They are carried over
 * unchanged only because nothing can reach them yet — whoever sets real
 * pricing must bring these down to match it, or price the subscription to
 * match them. Shipping either number as-is sells a subscription at a loss.
 */
export const PRO_TOKEN_CAP = 3_000_000;
export const MAX_TOKEN_CAP = 10_000_000;

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

/**
 * The tiers, spelled exactly as the app spells them in types/types.ts.
 *
 * These two vocabularies MUST stay identical. This file used to say
 * "free" | "premium" while the app said "free" | "pro" | "max", which was
 * harmless only because nothing could write a paid tier yet. The day
 * RevenueCat writes "pro" onto a document, a server that does not know the
 * word resolves it to free and silently bills someone for the free allowance.
 */
export type Tier = "free" | "pro" | "max";

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

const CAP_BY_TIER: Record<Tier, number> = {
  free: FREE_TOKEN_CAP,
  pro: PRO_TOKEN_CAP,
  max: MAX_TOKEN_CAP,
};

export const capForTier = (tier: Tier): number => CAP_BY_TIER[tier];

/**
 * Narrows whatever is stored in a document's `tier` field to a real tier.
 *
 * Anything unrecognised — missing, misspelt, left over from the old
 * "premium" vocabulary, or corrupted — becomes "free". That direction is not
 * arbitrary: a bad value can then only ever cost a user allowance, never
 * grant it. The opposite default would make a typo in the Firebase console
 * into an unlimited free upgrade.
 */
export const parseTier = (value: unknown): Tier =>
  value === "pro" || value === "max" ? value : "free";
