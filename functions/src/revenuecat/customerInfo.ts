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
import type { Tier } from "../quota/caps.js";

/** One entry of customer_info.entitlements, keyed by entitlement name. */
interface Entitlement {
  product_identifier: string;
  /** ISO-8601. null means it never expires. */
  expires_date: string | null;
  /** ISO-8601. Set while the store is still retrying a failed charge. */
  grace_period_expires_date?: string | null;
}

/** One entry of customer_info.subscriptions, keyed by product id. */
interface Subscription {
  is_sandbox: boolean;
}

/**
 * The part of the extension's customer document this file reads. The real
 * document carries more; everything else is ignored.
 */
export interface CustomerInfo {
  entitlements: Record<string, Entitlement>;
  subscriptions: Record<string, Subscription>;
}

/** What aiUsage needs to know about a customer's plan. */
export type PlanState =
  | { tier: "free" }
  | {
      tier: Exclude<Tier, "free">;
      entitlementExpiresAtMs: number;
      isSandbox: boolean;
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
  customerInfo: CustomerInfo,
  nowMs: number,
): PlanState => {
  for (const tier of PAID_TIERS_BEST_FIRST) {
    const entitlement = customerInfo.entitlements[tier];
    const entitlementExpiresAtMs = activeUntilMs(entitlement, nowMs);

    // activeUntilMs returns a date only for an entitlement that exists, so
    // past this line `entitlement` is safe to read.
    if (entitlementExpiresAtMs === undefined) continue;

    // A product with no subscriptions entry should never happen. If it does
    // we cannot prove the money was real, so fail closed and call it sandbox.
    const isSandbox =
      customerInfo.subscriptions[entitlement.product_identifier]?.is_sandbox ??
      true;

    return { tier, entitlementExpiresAtMs, isSandbox };
  }

  return { tier: "free" };
};
