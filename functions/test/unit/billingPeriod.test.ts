import { describe, expect, it } from "vitest";
import { billingPeriodOf } from "../../src/revenuecat/billingPeriod.js";

/**
 * The card's "Pro yearly" comes from the product ID alone: RevenueCat's
 * customer document carries no billing-period field.
 */
describe("billingPeriodOf", () => {
  it("reads monthly from an App Store style id", () => {
    expect(billingPeriodOf("hercule_max_monthly")).toBe("monthly");
  });

  it("reads yearly from an App Store style id", () => {
    expect(billingPeriodOf("hercule_pro_yearly")).toBe("yearly");
  });

  it("reads the period from a Google Play subscription:basePlan id", () => {
    expect(billingPeriodOf("hercule_pro:yearly")).toBe("yearly");
  });

  it("returns null for an id that does not end in a period", () => {
    expect(billingPeriodOf("hercule_pro")).toBeNull();
  });

  it("returns null when the period is not at the end", () => {
    // A wrong period is worse than none: the card would state it as fact.
    expect(billingPeriodOf("hercule_yearly_pro")).toBeNull();
  });

  it("returns null for a word that only ends like a period", () => {
    expect(billingPeriodOf("herculeyearly")).toBeNull();
  });

  it("returns null when there is no product", () => {
    expect(billingPeriodOf(null)).toBeNull();
  });
});
