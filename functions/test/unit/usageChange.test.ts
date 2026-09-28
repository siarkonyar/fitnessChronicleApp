import { describe, expect, it } from "vitest";
import type { PlanState } from "../../src/revenuecat/customerInfo.js";
import { nextPaidPeriodEnd } from "../../src/quota/period.js";
import { usageChange } from "../../src/revenuecat/usageChange.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

const PAID_AT = NOW - 10 * DAY;
const EXPIRES = NOW + 20 * DAY;

const FREE: PlanState = { tier: "free" };

type PaidPlan = Extract<PlanState, { tier: "pro" | "max" }>;

const paid = (overrides: Partial<PaidPlan> = {}): PaidPlan => ({
  tier: "pro",
  entitlementExpiresAtMs: EXPIRES,
  purchasedAtMs: PAID_AT,
  isSandbox: false,
  ...overrides,
});

/**
 * What one snapshot of a RevenueCat customer should change on their aiUsage
 * document.
 *
 * THE RULE THAT MATTERS: tokens reset only when a payment happened — a first
 * purchase, a renewal, or a change of plan. Never because the snapshot was
 * delivered again, and never because a store's billing grace pushed the
 * expiry out, or a card failure would hand out a free month.
 */
describe("usageChange", () => {
  describe("a customer with no active plan", () => {
    it("leaves a free user alone", () => {
      expect(
        usageChange({ tier: "free", lastPurchaseAtMs: undefined }, FREE, NOW),
      ).toEqual({ kind: "unchanged" });
    });

    it("downgrades a paid user, handing them to the free rules from now", () => {
      // periodEnd = now makes the next checkQuota open a fresh free period —
      // the same path a lapsed user takes through effectiveTier, so there is
      // still no separate downgrade branch in the quota code.
      expect(
        usageChange({ tier: "pro", lastPurchaseAtMs: PAID_AT }, FREE, NOW),
      ).toEqual({ kind: "downgrade", periodEndMs: NOW });
    });
  });

  describe("a customer with an active plan", () => {
    it("resets tokens on a first purchase", () => {
      expect(
        usageChange({ tier: "free", lastPurchaseAtMs: undefined }, paid(), NOW),
      ).toEqual({
        kind: "paid",
        tier: "pro",
        entitlementExpiresAtMs: EXPIRES,
        lastPurchaseAtMs: PAID_AT,
        resetPeriodEndMs: nextPaidPeriodEnd(EXPIRES, NOW),
      });
    });

    it("does not reset when the same snapshot arrives again", () => {
      // Firestore triggers are at-least-once. A second delivery must be a
      // no-op for the counter, or it is a second free allowance.
      expect(
        usageChange({ tier: "pro", lastPurchaseAtMs: PAID_AT }, paid(), NOW),
      ).toMatchObject({ kind: "paid", resetPeriodEndMs: null });
    });

    it("resets tokens on a renewal", () => {
      const renewedAt = NOW - DAY;
      const renewedUntil = NOW + 29 * DAY;

      expect(
        usageChange(
          { tier: "pro", lastPurchaseAtMs: PAID_AT },
          paid({ purchasedAtMs: renewedAt, entitlementExpiresAtMs: renewedUntil }),
          NOW,
        ),
      ).toMatchObject({
        kind: "paid",
        lastPurchaseAtMs: renewedAt,
        resetPeriodEndMs: nextPaidPeriodEnd(renewedUntil, NOW),
      });
    });

    it("does not reset when billing grace pushes the expiry out", () => {
      // The card failed. The store keeps them subscribed while it retries, so
      // the expiry moved — but nobody paid. Updates the expiry, keeps the
      // counter.
      expect(
        usageChange(
          { tier: "pro", lastPurchaseAtMs: PAID_AT },
          paid({ entitlementExpiresAtMs: NOW + 16 * DAY }),
          NOW,
        ),
      ).toEqual({
        kind: "paid",
        tier: "pro",
        entitlementExpiresAtMs: NOW + 16 * DAY,
        lastPurchaseAtMs: PAID_AT,
        resetPeriodEndMs: null,
      });
    });

    it("resets tokens when the plan changes", () => {
      // pro -> max is a new purchase with its own, bigger allowance.
      expect(
        usageChange(
          { tier: "pro", lastPurchaseAtMs: PAID_AT },
          paid({ tier: "max" }),
          NOW,
        ),
      ).toMatchObject({
        kind: "paid",
        tier: "max",
        resetPeriodEndMs: nextPaidPeriodEnd(EXPIRES, NOW),
      });
    });

    it("resets tokens for a paid document with no purchase on record", () => {
      // Nothing to compare against, so this cannot be a redelivery of a
      // payment we have already counted.
      expect(
        usageChange({ tier: "pro", lastPurchaseAtMs: undefined }, paid(), NOW),
      ).toMatchObject({ resetPeriodEndMs: nextPaidPeriodEnd(EXPIRES, NOW) });
    });

    it("does not reset for a purchase older than the one on record", () => {
      expect(
        usageChange(
          { tier: "pro", lastPurchaseAtMs: PAID_AT },
          paid({ purchasedAtMs: PAID_AT - DAY }),
          NOW,
        ),
      ).toMatchObject({ resetPeriodEndMs: null });
    });
  });
});
