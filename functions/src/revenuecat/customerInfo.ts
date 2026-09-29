/**
 * Reads the RevenueCat Firebase extension's snapshot of a customer.
 *
 * The extension rewrites one document per customer every time anything about
 * their purchases changes, so this is always the CURRENT state — never an
 * event to be applied in order. That is what lets this stay a plain function
 * of (snapshot, clock) with no memory of what came before.
 *
 * Pure, with an injected clock, for the same reason entitlement.ts is: it
 * decides how much money a user is allowed to cost us.
 */
import type { RevenueCatCustomer } from "../data/schemas.js";
import type { Tier } from "../quota/caps.js";

type Entitlement = RevenueCatCustomer["entitlements"][string];

/** What aiUsage needs to know about a customer's plan. */
export type PlanState =
  | { tier: "free" }
  | {
      tier: Exclude<Tier, "free">;
      entitlementExpiresAtMs: number;
      /**
       * When the current billing period was paid for. Moves only when money
       * actually changes hands — unlike the expiry, which a store's billing
       * grace period also pushes out — so it is what decides a token reset.
       */
      purchasedAtMs: number;
      isSandbox: boolean;
      /** The product that granted the plan. For support; decides nothing. */
      productId: string;
      /** Where it was bought, if RevenueCat said. For support; decides nothing. */
      store: string | null;
    };

const activeUntilMs = (
  entitlement: Entitlement | undefined,
  nowMs: number,
): number | undefined => {
  if (entitlement === undefined || entitlement.expires_date === null) {
    return undefined;
  }

  const expiresAtMs = Date.parse(entitlement.expires_date);
  const graceEndsAtMs = entitlement.grace_period_expires_date
    ? Date.parse(entitlement.grace_period_expires_date)
    : expiresAtMs;
  const endsAtMs = Math.max(expiresAtMs, graceEndsAtMs);

  return endsAtMs > nowMs ? endsAtMs : undefined;
};

/**
 * The paid tiers, best first. The order IS the tie-break: during an upgrade
 * the store can report the old and the new product together until the old
 * one's period ends, and the customer is paying for the better one.
 *
 * Also the whitelist. Entitlement names are looked up by these exact words,
 * so anything else in the dashboard — a typo, an old "premium" — is never
 * read, and can only cost allowance, never grant it. Same rule as parseTier.
 */
const PAID_TIERS_BEST_FIRST = ["max", "pro"] as const satisfies readonly Tier[];

export const readSubscription = (
  customerInfo: RevenueCatCustomer,
  nowMs: number,
): PlanState => {
  for (const tier of PAID_TIERS_BEST_FIRST) {
    const entitlement = customerInfo.entitlements[tier];
    const entitlementExpiresAtMs = activeUntilMs(entitlement, nowMs);

    // activeUntilMs returns a date only for an entitlement that exists, so
    // past this line `entitlement` is safe to read.
    if (entitlementExpiresAtMs === undefined) continue;

    const productId = entitlement.product_identifier;
    const subscription = customerInfo.subscriptions[productId];

    return {
      tier,
      entitlementExpiresAtMs,
      purchasedAtMs: Date.parse(entitlement.purchase_date),
      // A product with no subscriptions entry should never happen. If it
      // does we cannot prove the money was real, so fail closed: sandbox.
      isSandbox: subscription?.is_sandbox ?? true,
      productId,
      store: subscription?.store ?? null,
    };
  }

  return { tier: "free" };
};
