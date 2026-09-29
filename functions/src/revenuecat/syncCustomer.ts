import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/firestore";
import {
  REVENUECAT_CUSTOMERS_COLLECTION,
  aiUsageDoc,
  db,
  revenueCatCustomerDoc,
} from "../data/firestore.js";
import { RevenueCatCustomerSchema } from "../data/schemas.js";
import { parseTier } from "../quota/caps.js";
import { readSubscription } from "./customerInfo.js";
import { type UsageChange, usageChange } from "./usageChange.js";

/**
 * Spelled out rather than imported from index.ts, which re-exports this
 * trigger — importing REGION back out of it would be a cycle. The other
 * triggers hardcode the same string for the same reason.
 */
const TRIGGER_REGION = "europe-west2";

/** What RevenueCat calls a customer who bought before Purchases.logIn(uid). */
const ANONYMOUS_ID_PREFIX = "$RCAnonymousID:";

export type SyncOutcome =
  /** A payment was counted: plan written, counter zeroed. */
  | "reset"
  /** Plan written, counter kept (a redelivery, a grace extension, a cancel). */
  | "updated"
  /** A paid user whose plan ended, handed back to the free rules. */
  | "downgraded"
  /** A free user with no plan. Nothing to write. */
  | "unchanged"
  /** The id is not a live Firebase account. Nothing written. */
  | "not_a_user"
  /** The customer document is gone. Nothing written. */
  | "no_customer"
  /** The customer document failed the schema. Nothing written. */
  | "invalid";

/**
 * Whether `appUserId` is a Firebase account that exists right now.
 *
 * Refuses two things that would otherwise write an orphan aiUsage document:
 * an anonymous RevenueCat id (checked by prefix, without a network call), and
 * a uid whose account is gone — writing it would resurrect the counter that
 * onUserDeleted just removed. Any other auth error is rethrown, so the
 * trigger retries rather than silently skipping a paying customer.
 */
const isLiveFirebaseUser = async (appUserId: string): Promise<boolean> => {
  if (appUserId.startsWith(ANONYMOUS_ID_PREFIX)) return false;

  try {
    await getAuth().getUser(appUserId);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      return false;
    }
    throw error;
  }
};

const toMillis = (value: unknown): number | undefined =>
  value instanceof Timestamp ? value.toMillis() : undefined;

/**
 * The aiUsage fields a change writes, merged into the existing document.
 *
 * `syncedAt` is written on every change: when this trigger last wrote the
 * plan. Next to the customer document's own dates, it is how support tells
 * "RevenueCat never told us" apart from "we were told and refused".
 */
const fieldsFor = (
  change: Exclude<UsageChange, { kind: "unchanged" }>,
): FirebaseFirestore.DocumentData => {
  const syncedAt = FieldValue.serverTimestamp();

  if (change.kind === "downgrade") {
    // The support fields describe the plan that just ended. Left behind,
    // they would tell the next reader this free user holds a product.
    return {
      tier: "free",
      entitlementExpiresAt: FieldValue.delete(),
      periodEnd: Timestamp.fromMillis(change.periodEndMs),
      productId: FieldValue.delete(),
      store: FieldValue.delete(),
      isSandbox: FieldValue.delete(),
      syncedAt,
    };
  }

  return {
    tier: change.tier,
    entitlementExpiresAt: Timestamp.fromMillis(change.entitlementExpiresAtMs),
    lastPurchaseAt: Timestamp.fromMillis(change.lastPurchaseAtMs),
    productId: change.productId,
    store: change.store,
    isSandbox: change.isSandbox,
    syncedAt,
    ...(change.resetPeriodEndMs !== null && {
      tokensUsed: 0,
      periodEnd: Timestamp.fromMillis(change.resetPeriodEndMs),
    }),
  };
};

const outcomeOf = (change: UsageChange): SyncOutcome => {
  switch (change.kind) {
    case "unchanged":
      return "unchanged";
    case "downgrade":
      return "downgraded";
    case "paid":
      return change.resetPeriodEndMs === null ? "updated" : "reset";
  }
};

/**
 * Copies a customer's CURRENT RevenueCat plan onto their aiUsage document.
 *
 * READS THE CUSTOMER DOCUMENT AGAIN rather than trusting the snapshot the
 * trigger was handed. Triggers can be delivered late and out of order; a
 * stale snapshot applied after a newer one would roll the plan backwards.
 * Re-reading means every run applies the latest state, so the order they run
 * in stops mattering — and a retry is always safe.
 *
 * Both documents are read and aiUsage written in ONE transaction, so a
 * concurrent checkQuota can never interleave between the decision and the
 * write.
 */
export const syncCustomer = async (
  appUserId: string,
  now: Date = new Date(),
): Promise<SyncOutcome> => {
  if (!(await isLiveFirebaseUser(appUserId))) {
    logger.warn("Ignoring RevenueCat customer with no Firebase account", {
      appUserId,
    });
    return "not_a_user";
  }

  const customerRef = revenueCatCustomerDoc(appUserId);
  const usageRef = aiUsageDoc(appUserId);
  const nowMs = now.getTime();

  return db.runTransaction<SyncOutcome>(async (tx) => {
    // Firestore requires every read in a transaction to precede every write.
    const [customerSnapshot, usageSnapshot] = await Promise.all([
      tx.get(customerRef),
      tx.get(usageRef),
    ]);

    if (!customerSnapshot.exists) return "no_customer";

    const parsed = RevenueCatCustomerSchema.safeParse(customerSnapshot.data());
    if (!parsed.success) {
      // Logged, not thrown: retrying cannot fix a malformed document, and a
      // retried trigger would keep failing for days. The next write the
      // extension makes to this customer runs the trigger again anyway.
      logger.error("RevenueCat customer document failed validation", {
        uid: appUserId,
        issues: parsed.error.issues,
      });
      return "invalid";
    }

    const plan = readSubscription(parsed.data, nowMs);
    const usage = usageSnapshot.data();
    const change = usageChange(
      {
        tier: parseTier(usage?.tier),
        lastPurchaseAtMs: toMillis(usage?.lastPurchaseAt),
      },
      plan,
      nowMs,
    );

    // Accepted by decision (2026-09-28): App Review buys with sandbox
    // accounts, and test subscriptions expire within hours. Logged so they
    // can be told apart from real revenue. May log twice if the transaction
    // re-runs on contention; a rare duplicate line is worth the simplicity.
    if (plan.tier !== "free" && plan.isSandbox) {
      logger.info("Applying a sandbox purchase", { uid: appUserId, tier: plan.tier });
    }

    if (change.kind !== "unchanged") {
      tx.set(usageRef, fieldsFor(change), { merge: true });
    }

    return outcomeOf(change);
  });
};

/**
 * Keeps aiUsage in step with what the RevenueCat extension writes.
 *
 * RETRIED ON FAILURE, deliberately, like onUserDeleted and unlike
 * onConsentChanged. syncCustomer re-reads the latest state and only resets
 * the counter for a purchase it has not counted, so running it twice writes
 * the same thing twice. Only unexpected errors (Firestore or Auth being
 * unavailable) are thrown; the outcomes that retrying cannot fix are returned.
 */
export const onRevenueCatCustomerWritten = onDocumentWritten(
  {
    document: `${REVENUECAT_CUSTOMERS_COLLECTION}/{appUserId}`,
    region: TRIGGER_REGION,
    retry: true,
  },
  async (event) => {
    const { appUserId } = event.params;
    const outcome = await syncCustomer(appUserId);

    logger.info("Synced RevenueCat customer", { uid: appUserId, outcome });
  },
);
