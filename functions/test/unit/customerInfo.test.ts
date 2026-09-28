import { describe, expect, it } from "vitest";
import {
  type RevenueCatCustomer,
  RevenueCatCustomerSchema,
} from "../../src/data/schemas.js";
import { readSubscription } from "../../src/revenuecat/customerInfo.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

/** When the fixtures' current billing period was paid for. */
const PAID_AT = NOW - 10 * DAY;

const iso = (ms: number): string => new Date(ms).toISOString();

const MONTHLY_PRO = "hercule_pro_monthly";
const MONTHLY_MAX = "hercule_max_monthly";

/**
 * A customer the way the RevenueCat Firebase extension writes it, cut down to
 * the fields readSubscription reads. Each entitlement points at the product
 * that grants it, and every product has a subscriptions entry.
 */
const customerWith = (
  entitlements: RevenueCatCustomer["entitlements"],
  sandboxProducts: readonly string[] = [],
): RevenueCatCustomer => ({
  entitlements,
  subscriptions: Object.fromEntries(
    Object.values(entitlements).map(({ product_identifier }) => [
      product_identifier,
      { is_sandbox: sandboxProducts.includes(product_identifier) },
    ]),
  ),
});

const entitlement = (
  productId: string,
  expiresAtMs: number | null,
  graceEndsAtMs: number | null = null,
) => ({
  product_identifier: productId,
  purchase_date: iso(PAID_AT),
  expires_date: expiresAtMs === null ? null : iso(expiresAtMs),
  grace_period_expires_date: graceEndsAtMs === null ? null : iso(graceEndsAtMs),
});

/**
 * Turns the extension's snapshot of a customer into what aiUsage needs: which
 * tier, until when, when it was last paid for, and whether it was a test
 * purchase.
 *
 * Pure, with an injected clock, for the same reason entitlement.ts is: it
 * decides how much money a user may cost us.
 */
describe("readSubscription", () => {
  it("returns free for a customer with no entitlements", () => {
    expect(readSubscription(customerWith({}), NOW)).toEqual({ tier: "free" });
  });

  it("returns pro with its dates for an active pro entitlement", () => {
    const customer = customerWith({ pro: entitlement(MONTHLY_PRO, NOW + 20 * DAY) });

    expect(readSubscription(customer, NOW)).toEqual({
      tier: "pro",
      entitlementExpiresAtMs: NOW + 20 * DAY,
      purchasedAtMs: PAID_AT,
      isSandbox: false,
    });
  });

  it("returns max for an active max entitlement", () => {
    const customer = customerWith({ max: entitlement(MONTHLY_MAX, NOW + 20 * DAY) });

    expect(readSubscription(customer, NOW).tier).toBe("max");
  });

  it("prefers max when both pro and max are active", () => {
    // Happens briefly during an upgrade: the store can report the old and the
    // new product together until the old one's period ends.
    const customer = customerWith({
      pro: entitlement(MONTHLY_PRO, NOW + 25 * DAY),
      max: entitlement(MONTHLY_MAX, NOW + 5 * DAY),
    });

    expect(readSubscription(customer, NOW)).toEqual({
      tier: "max",
      entitlementExpiresAtMs: NOW + 5 * DAY,
      purchasedAtMs: PAID_AT,
      isSandbox: false,
    });
  });

  it("falls back to pro when max has expired but pro has not", () => {
    const customer = customerWith({
      pro: entitlement(MONTHLY_PRO, NOW + 10 * DAY),
      max: entitlement(MONTHLY_MAX, NOW - DAY),
    });

    expect(readSubscription(customer, NOW).tier).toBe("pro");
  });

  it("returns free when the only entitlement has expired", () => {
    const customer = customerWith({ pro: entitlement(MONTHLY_PRO, NOW - DAY) });

    expect(readSubscription(customer, NOW)).toEqual({ tier: "free" });
  });

  it("treats an entitlement expiring exactly now as expired", () => {
    // Same boundary as entitlement.ts and period.ts: at the deadline access is
    // over, not ending.
    const customer = customerWith({ pro: entitlement(MONTHLY_PRO, NOW) });

    expect(readSubscription(customer, NOW)).toEqual({ tier: "free" });
  });

  it("keeps access through the store's billing grace period", () => {
    // The card failed and the period ended, but the store is still retrying
    // the charge and has told RevenueCat to keep the customer subscribed.
    const customer = customerWith({
      pro: entitlement(MONTHLY_PRO, NOW - DAY, NOW + 5 * DAY),
    });

    expect(readSubscription(customer, NOW)).toEqual({
      tier: "pro",
      entitlementExpiresAtMs: NOW + 5 * DAY,
      purchasedAtMs: PAID_AT,
      isSandbox: false,
    });
  });

  it("ignores an entitlement name we do not sell", () => {
    // Same rule as parseTier: an unknown word can only cost allowance, never
    // grant it.
    const customer = customerWith({
      premium: entitlement("hercule_premium", NOW + 20 * DAY),
    });

    expect(readSubscription(customer, NOW)).toEqual({ tier: "free" });
  });

  it("ignores an entitlement that never expires", () => {
    // Nothing Hercule sells is lifetime, and aiUsage needs an expiry date to
    // anchor the monthly refill. A lifetime grant from the dashboard would
    // otherwise become an unlimited paid tier.
    const customer = customerWith({ pro: entitlement(MONTHLY_PRO, null) });

    expect(readSubscription(customer, NOW)).toEqual({ tier: "free" });
  });

  it("reports a sandbox purchase as sandbox", () => {
    const customer = customerWith(
      { pro: entitlement(MONTHLY_PRO, NOW + 20 * DAY) },
      [MONTHLY_PRO],
    );

    expect(readSubscription(customer, NOW)).toMatchObject({ isSandbox: true });
  });

  it("treats a product missing from subscriptions as sandbox", () => {
    // Should never happen. If it does we cannot prove the money was real, so
    // fail closed, like every other unknown in the quota code.
    const customer: RevenueCatCustomer = {
      entitlements: { pro: entitlement(MONTHLY_PRO, NOW + 20 * DAY) },
      subscriptions: {},
    };

    expect(readSubscription(customer, NOW)).toMatchObject({ isSandbox: true });
  });
});

/**
 * The extension's document is written by someone else's code, so the trigger
 * checks it before trusting it.
 */
describe("RevenueCatCustomerSchema", () => {
  it("keeps only the fields readSubscription reads", () => {
    // The real document carries much more: aliases, the extension's own
    // watermark, first_seen, every subscription field.
    const stored = {
      ...customerWith({ pro: entitlement(MONTHLY_PRO, NOW + 20 * DAY) }),
      aliases: ["abc"],
      rc_last_event_timestamp_ms: NOW,
      first_seen: iso(PAID_AT),
    };

    const parsed = RevenueCatCustomerSchema.parse(stored);

    expect(Object.keys(parsed).sort()).toEqual(["entitlements", "subscriptions"]);
  });

  it("rejects a document with no entitlements", () => {
    const result = RevenueCatCustomerSchema.safeParse({ subscriptions: {} });

    expect(result.success).toBe(false);
  });

  it("rejects a date that is not a date", () => {
    const result = RevenueCatCustomerSchema.safeParse(
      customerWith({
        pro: { ...entitlement(MONTHLY_PRO, NOW + 20 * DAY), expires_date: "soon" },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an entitlement with no purchase date", () => {
    const { purchase_date: _, ...withoutPurchaseDate } = entitlement(
      MONTHLY_PRO,
      NOW + 20 * DAY,
    );

    const result = RevenueCatCustomerSchema.safeParse({
      entitlements: { pro: withoutPurchaseDate },
      subscriptions: { [MONTHLY_PRO]: { is_sandbox: false } },
    });

    expect(result.success).toBe(false);
  });
});
