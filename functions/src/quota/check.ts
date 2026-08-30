import { Timestamp } from "firebase-admin/firestore";
import { aiUsageDoc, db } from "../data/firestore.js";
import { trySpend, type BucketState } from "./bucket.js";
import {
  BUCKET_CAPACITY,
  MIN_HEADROOM_TOKENS,
  PERIOD_DAYS,
  capForTier,
  type Tier,
} from "./caps.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Why a turn was refused.
 *
 * The app needs to tell these apart: "you've used your allowance for the
 * month" and "you're going too fast, wait ten seconds" call for completely
 * different messages, and Firebase has no distinct too-many-requests code.
 */
export type RejectionReason = "quota" | "rate_limit";

export interface QuotaState {
  tokensUsed: number;
  cap: number;
  tier: Tier;
  /** 0-100, rounded. The only usage figure the app is ever told. */
  percentUsed: number;
}

export interface QuotaDecision extends QuotaState {
  allowed: boolean;
  /** Set only when allowed is false. */
  reason?: RejectionReason;
}

export interface CheckQuotaOptions {
  /**
   * Whether this call consumes one of the caller's rate-limit tokens.
   *
   * True for anything that can lead to a Gemini call. False for read-only
   * callers such as getUsagePercentage, which the app hits every time the chat
   * box opens — charging those would let a user rate-limit themselves out of
   * the coach just by opening and closing the chat five times.
   */
  spendRateToken?: boolean;
}

/**
 * 0-100, measured against what a user can actually SPEND, not the raw cap.
 *
 * The gate below refuses a turn while MIN_HEADROOM_TOKENS still remain, so the
 * cap itself is unreachable: a free user is cut off at 35_000 of a 40_000 cap,
 * and dividing by the cap froze the bar at 88% forever. The bar then claimed
 * "12% left" while the coach refused to answer, which reads as the app being
 * broken rather than as the allowance being spent.
 *
 * Dividing by `cap - MIN_HEADROOM_TOKENS` makes the bar reach 100% at exactly
 * the point the gate starts refusing, so the number the user sees and the
 * behaviour they get agree.
 *
 * Clamped, because a turn can overshoot the budget by design.
 */
export const toPercentUsed = (tokensUsed: number, cap: number): number => {
  const spendable = cap - MIN_HEADROOM_TOKENS;

  // A cap at or below the headroom means nothing can ever be spent — which is
  // exactly what FREE_TOKEN_CAP was back when it was 0. It also makes the
  // division below 0/0, i.e. NaN, or negative. NaN is not valid JSON, so it
  // reaches the app as null and renders as a blank usage bar. That is the
  // opposite of the truth: no spendable allowance is 100% used.
  if (spendable <= 0) return 100;

  return Math.min(100, Math.round((tokensUsed / spendable) * 100));
};

const isExpired = (periodStart: Timestamp, now: Date): boolean =>
  now.getTime() - periodStart.toMillis() >= PERIOD_DAYS * MS_PER_DAY;

/**
 * Reads the bucket out of a stored doc, defaulting a missing one to FULL.
 *
 * Full, not empty, is deliberate: the deploy that introduces rate limiting
 * finds every existing user without these fields, and starting them empty
 * would lock the entire user base out of the coach on first contact.
 */
const readBucket = (
  data: FirebaseFirestore.DocumentData | undefined,
  nowMs: number,
): BucketState => ({
  tokens:
    typeof data?.rateTokens === "number" ? data.rateTokens : BUCKET_CAPACITY,
  lastRefill:
    typeof data?.rateLastRefill === "number" ? data.rateLastRefill : nowMs,
});

/**
 * Reads the caller's usage and decides whether this turn may run.
 *
 * MUST be called before the model. A gate that runs afterwards has already
 * paid for the request it is rejecting.
 *
 * Two separate limits are enforced here, in this order:
 *
 *   1. A per-user token bucket (BUCKET_CAPACITY burst, one token back every
 *      REFILL_INTERVAL_MS) that bounds the request RATE.
 *   2. The monthly token allowance that bounds total SPEND.
 *
 * The bucket is spent BEFORE the allowance is judged, so a user already over
 * quota is still rate-limited on their rejections. The other order would let a
 * quota-blocked spammer hammer the endpoint for free, and rejections are not
 * free — each one is a Firestore read.
 *
 * Rolling the period happens here, inside a transaction, so two concurrent
 * turns at a period boundary cannot both reset the counter and lose one
 * another's usage. The bucket rides in the same transaction, which is what
 * makes "exactly five concurrent turns get through" true rather than
 * approximately true.
 *
 * `tier` is only ever created as "free" and is never read from the request —
 * it lives in this document precisely because the client cannot reach it.
 * Today you set it by hand in the console; RevenueCat writes it later.
 *
 * Known gap: this function checks the token budget, it does not reserve it.
 * Several concurrent turns can each read the same balance, each pass, and each
 * spend. The bucket now bounds that overshoot hard — at most BUCKET_CAPACITY
 * turns can be in flight at once, so the worst case is roughly
 * MIN_HEADROOM_TOKENS x BUCKET_CAPACITY rather than being unbounded. Closing
 * it completely needs a reserve-then-reconcile design, which also means
 * charging users for turns that fail. Left open deliberately.
 */
export const checkQuota = async (
  uid: string,
  now: Date = new Date(),
  { spendRateToken = true }: CheckQuotaOptions = {},
): Promise<QuotaDecision> => {
  const ref = aiUsageDoc(uid);
  const nowMs = now.getTime();

  const state = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();

    // Anything other than exactly "premium" falls to "free". A corrupted or
    // missing tier field can only ever cost a user allowance, never grant one.
    const tier: Tier = data?.tier === "premium" ? "premium" : "free";
    const periodStart = data?.periodStart as Timestamp | undefined;

    // No document yet, or the period has rolled over.
    const isNewPeriod =
      !snapshot.exists || !periodStart || isExpired(periodStart, now);

    const tokensUsed = isNewPeriod
      ? 0
      : typeof data?.tokensUsed === "number"
        ? data.tokensUsed
        : 0;

    const periodFields = isNewPeriod
      ? { tokensUsed: 0, periodStart: Timestamp.fromDate(now), tier }
      : {};

    // Read-only callers stop here. They still create the document on first
    // contact, so the usage bar has something to read, but they never touch
    // the bucket.
    if (!spendRateToken) {
      if (isNewPeriod) tx.set(ref, periodFields, { merge: true });
      return { tokensUsed, tier, rateLimited: false };
    }

    const spend = trySpend(readBucket(data, nowMs), nowMs);

    if (!spend.ok) {
      // Deliberately writes NOTHING. This path is, by definition, the one a
      // flood hits over and over, and a write per rejected request would hand
      // the spammer control of our Firestore bill. Nothing is lost by skipping
      // it: refill() is a pure function of the stored state and the clock, so
      // the next call recomputes the identical answer.
      return { tokensUsed, tier, rateLimited: true };
    }

    tx.set(
      ref,
      {
        ...periodFields,
        rateTokens: spend.next.tokens,
        rateLastRefill: spend.next.lastRefill,
      },
      { merge: true },
    );

    return { tokensUsed, tier, rateLimited: false };
  });

  const cap = capForTier(state.tier);
  const remaining = cap - state.tokensUsed;

  // Refused while headroom remains, not at zero: a turn's cost is only known
  // once it has run, so stopping exactly at the cap would let one last turn
  // spend far past it.
  const withinBudget = remaining >= MIN_HEADROOM_TOKENS;
  const allowed = !state.rateLimited && withinBudget;

  return {
    allowed,
    // Rate limiting wins the label when both apply: it is the condition the
    // user can actually fix, and telling someone to wait ten seconds when they
    // are out of allowance for the month would simply be wrong.
    ...(allowed
      ? {}
      : { reason: state.rateLimited ? "rate_limit" : ("quota" as const) }),
    tokensUsed: state.tokensUsed,
    cap,
    tier: state.tier,
    percentUsed: toPercentUsed(state.tokensUsed, cap),
  };
};
