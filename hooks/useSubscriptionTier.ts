import { SubscriptionTierSchema } from "@/types/types";
import { z } from "zod";

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

/**
 * Subscriptions are not implemented yet. Every user is treated as free.
 *
 * TODO: Replace with the real tier once billing exists — read it from the
 * user document (or the store receipt) and parse it through
 * `SubscriptionTierSchema` so an unknown value fails loudly instead of
 * silently unlocking a paid tier.
 */
const HARDCODED_TIER: SubscriptionTier = "free";

export function useSubscriptionTier(): SubscriptionTier {
  return HARDCODED_TIER;
}
