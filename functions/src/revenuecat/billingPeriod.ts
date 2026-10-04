/**
 * How often a product bills, read from its id.
 *
 * RevenueCat's customer document has no billing-period field, so the product
 * id is the only source. That makes this a NAMING RULE the store products
 * must follow: App Store ids end in `_monthly` / `_yearly`, Google Play base
 * plans are called `monthly` / `yearly` (RevenueCat joins them as
 * `subscription:basePlan`).
 *
 * Anything else is null, and the card then shows just "Pro". Only the plan
 * card reads this — it decides nothing about what a user may spend.
 */
export type BillingPeriod = "monthly" | "yearly";

/** The period, only at the very end and only after a separator. */
const PERIOD_AT_END = /[_:](monthly|yearly)$/;

export const billingPeriodOf = (
  productId: string | null,
): BillingPeriod | null => {
  const match = productId?.match(PERIOD_AT_END);
  return match ? (match[1] as BillingPeriod) : null;
};
