/**
 * Token-bucket arithmetic for per-user rate limiting.
 *
 * Deliberately knows nothing about Firestore. The bucket rules are fiddly in
 * ways that are easy to get subtly wrong (see the two notes in trySpend), and
 * arithmetic with an injected clock can be tested exhaustively in milliseconds.
 * The moment this needed an emulator to test, the edge cases would stop being
 * covered.
 */
import { BUCKET_CAPACITY, REFILL_INTERVAL_MS } from "./caps.js";

/** A user's bucket at one moment in time. */
export interface BucketState {
  /** Turns available right now. Never above BUCKET_CAPACITY. */
  tokens: number;
  /** ms since epoch. The moment the current token count was last accurate. */
  lastRefill: number;
}

export interface SpendResult {
  /** Whether a token was available. False means: reject this request. */
  ok: boolean;
  /** The bucket to persist. On a refusal this is the refilled-but-unspent state. */
  next: BucketState;
}

/**
 * Brings a bucket up to date without spending anything.
 *
 * Pure: same inputs, same output, no clock of its own. That is what lets
 * check.ts skip writing on a refusal — the answer can always be recomputed
 * from the stored state.
 */
export const refill = (state: BucketState, nowMs: number): BucketState => {
  if (state.tokens >= BUCKET_CAPACITY) {
    return { tokens: BUCKET_CAPACITY, lastRefill: nowMs };
  }

  const elapsed = nowMs - state.lastRefill;
  const added = Math.floor(elapsed / REFILL_INTERVAL_MS);
  if (added <= 0) return state;

  const tokens = Math.min(BUCKET_CAPACITY, state.tokens + added);

  if (tokens >= BUCKET_CAPACITY) {
    return { tokens: BUCKET_CAPACITY, lastRefill: nowMs };
  }

  // Below capacity, advance by the whole intervals actually consumed — NOT to
  // nowMs. This is the first bug the plan warns about: 17s after the last
  // refill, one token is owed and 5s of credit is left over. Setting
  // lastRefill to nowMs would silently bin those 5s, every single call, making
  // the real refill rate slower than the 12s advertised.
  return {
    tokens,
    lastRefill: state.lastRefill + added * REFILL_INTERVAL_MS,
  };
};

/**
 * Refills, then takes one token if there is one.
 *
 * The caller persists `next` only when `ok` is true — see the note in
 * check.ts about not paying for a spammer's writes.
 */
export const trySpend = (state: BucketState, nowMs: number): SpendResult => {
  const refilled = refill(state, nowMs);

  if (refilled.tokens < 1) {
    return { ok: false, next: refilled };
  }

  return {
    ok: true,
    next: { tokens: refilled.tokens - 1, lastRefill: refilled.lastRefill },
  };
};
