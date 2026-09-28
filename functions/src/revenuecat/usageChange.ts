/**
 * What one snapshot of a RevenueCat customer should change on their aiUsage
 * document.
 *
 * Pure, like period.ts and entitlement.ts, because it decides the one thing
 * that costs money: when a user's token counter goes back to zero. The
 * trigger does the reading and writing; this only decides.
 */
import type { Tier } from "../quota/caps.js";
import { nextPaidPeriodEnd } from "../quota/period.js";
import type { PlanState } from "./customerInfo.js";

/** The parts of the stored aiUsage document the decision depends on. */
export interface StoredPlan {
  tier: Tier;
  /** The purchase_date last applied. Undefined if none ever was. */
  lastPurchaseAtMs: number | undefined;
}

export type UsageChange =
  /** Nothing to write. */
  | { kind: "unchanged" }
  /**
   * A paid user whose plan has ended. Ending their period NOW hands them to
   * the ordinary free rules on their next checkQuota, which open a fresh
   * 30-day period — the same path effectiveTier sends a lapsed user down.
   */
  | { kind: "downgrade"; periodEndMs: number }
  /**
   * Write the plan. `resetPeriodEndMs` is non-null only when a payment
   * happened: zero the counter and open a new period ending there.
   */
  | {
      kind: "paid";
      tier: Exclude<Tier, "free">;
      entitlementExpiresAtMs: number;
      lastPurchaseAtMs: number;
      resetPeriodEndMs: number | null;
    };

/**
 * Whether this snapshot carries a payment we have not counted yet.
 *
 * Keyed on purchase_date, NOT on the expiry moving later. A store's billing
 * grace period pushes the expiry out while a failed card is retried; keyed on
 * the expiry, a card failure would reset the counter, and the payment that
 * finally clears would reset it again — two free allowances.
 *
 * A change of plan counts too: pro -> max is a new purchase with its own
 * allowance, and max falling back to pro must not leave a max-sized counter
 * sitting over a pro-sized cap.
 *
 * STRICTLY later, so the same snapshot delivered twice — Firestore triggers
 * are at-least-once — never resets twice.
 */
const isNewPayment = (
  stored: StoredPlan,
  plan: Extract<PlanState, { tier: "pro" | "max" }>,
): boolean =>
  stored.tier !== plan.tier ||
  stored.lastPurchaseAtMs === undefined ||
  plan.purchasedAtMs > stored.lastPurchaseAtMs;

export const usageChange = (
  stored: StoredPlan,
  plan: PlanState,
  nowMs: number,
): UsageChange => {
  if (plan.tier === "free") {
    return stored.tier === "free"
      ? { kind: "unchanged" }
      : { kind: "downgrade", periodEndMs: nowMs };
  }

  return {
    kind: "paid",
    tier: plan.tier,
    entitlementExpiresAtMs: plan.entitlementExpiresAtMs,
    lastPurchaseAtMs: plan.purchasedAtMs,
    resetPeriodEndMs: isNewPayment(stored, plan)
      ? nextPaidPeriodEnd(plan.entitlementExpiresAtMs, nowMs)
      : null,
  };
};
