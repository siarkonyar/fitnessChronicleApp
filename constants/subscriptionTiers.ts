import type { SubscriptionTierSchema } from "@/types/types";
import type { z } from "zod";

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export interface TierConfig {
  /** On the badge. */
  label: string;
  /** In sentence text: "Pro yearly". */
  name: string;
  accentToken: "mutedText" | "secondary" | "highlight";
}

/**
 * One definition of how each tier looks, shared by the badge and the plan
 * card so the two can never disagree about a tier's colour.
 */
export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: { label: "FREE", name: "Free", accentToken: "mutedText" },
  pro: { label: "PRO", name: "Pro", accentToken: "secondary" },
  max: { label: "MAX", name: "Max", accentToken: "highlight" },
};

/** Hex alpha suffixes for the tier gradient, strongest corner first. */
export const TIER_GRADIENT_ALPHA = { start: "59", end: "1F" } as const;

/** Hex alpha suffix for the tier-coloured border. */
export const TIER_BORDER_ALPHA = "80";
