import { Timestamp } from "firebase-admin/firestore";
import { aiUsageDoc, db } from "../data/firestore.js";
import {
  MIN_HEADROOM_TOKENS,
  PERIOD_DAYS,
  capForTier,
  type Tier,
} from "./caps.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface QuotaState {
  tokensUsed: number;
  cap: number;
  tier: Tier;
  /** 0-100, rounded. The only usage figure the app is ever told. */
  percentUsed: number;
}

export interface QuotaDecision extends QuotaState {
  allowed: boolean;
}

/** 0-100. Clamped, because a turn can overshoot the cap by design. */
export const toPercentUsed = (tokensUsed: number, cap: number): number =>
  Math.min(100, Math.round((tokensUsed / cap) * 100));

const isExpired = (periodStart: Timestamp, now: Date): boolean =>
  now.getTime() - periodStart.toMillis() >= PERIOD_DAYS * MS_PER_DAY;

/**
 * Reads the caller's usage and decides whether this turn may run.
 *
 * MUST be called before the model. A gate that runs afterwards has already
 * paid for the request it is rejecting.
 *
 * Rolling the period happens here, inside a transaction, so two concurrent
 * turns at a period boundary cannot both reset the counter and lose one
 * another's usage. On the ordinary path the transaction only reads.
 *
 * `tier` is only ever created as "free" and is never read from the request —
 * it lives in this document precisely because the client cannot reach it.
 * Today you set it by hand in the console; RevenueCat writes it later.
 *
 * Known gap: this function only checks the budget, it does not reserve it.
 * Several concurrent turns can each read the same balance, each pass, and each
 * spend — the worst case is bounded by roughly MIN_HEADROOM_TOKENS times the
 * number of turns in flight at once. Closing that needs a reserve-then-
 * reconcile design, which also means charging users for turns that fail.
 * Left open deliberately for now.
 */
export const checkQuota = async (
  uid: string,
  now: Date = new Date(),
): Promise<QuotaDecision> => {
  const ref = aiUsageDoc(uid);

  const state = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();

    // Anything other than exactly "premium" falls to "free". A corrupted or
    // missing tier field can only ever cost a user allowance, never grant one.
    const tier: Tier = data?.tier === "premium" ? "premium" : "free";
    const periodStart = data?.periodStart as Timestamp | undefined;

    // No document yet, or the period has rolled over.
    if (!snapshot.exists || !periodStart || isExpired(periodStart, now)) {
      tx.set(
        ref,
        { tokensUsed: 0, periodStart: Timestamp.fromDate(now), tier },
        { merge: true },
      );
      return { tokensUsed: 0, tier };
    }

    return {
      tokensUsed: typeof data?.tokensUsed === "number" ? data.tokensUsed : 0,
      tier,
    };
  });

  const cap = capForTier(state.tier);
  const remaining = cap - state.tokensUsed;

  return {
    // Refused while headroom remains, not at zero: a turn's cost is only known
    // once it has run, so stopping exactly at the cap would let one last turn
    // spend far past it.
    allowed: remaining >= MIN_HEADROOM_TOKENS,
    tokensUsed: state.tokensUsed,
    cap,
    tier: state.tier,
    percentUsed: toPercentUsed(state.tokensUsed, cap),
  };
};
