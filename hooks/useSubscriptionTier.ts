import type { SubscriptionTier } from "@/constants/subscriptionTiers";
import { aiUsageQueryOptions } from "@/lib/ai/aiUsageQuery";
import { useQuery } from "@tanstack/react-query";

// Re-exported so existing `import { SubscriptionTier } from this hook` keeps
// working now the type lives with the rest of the tier definitions.
export type { SubscriptionTier };

/**
 * Anything other than a tier the server actually told us.
 *
 * Free is the only safe direction to fall back in: a missing, loading or
 * unreadable answer can then cost a user a badge they are entitled to, but it
 * can never show a paid badge to someone who has not paid.
 */
const FALLBACK_TIER: SubscriptionTier = "free";

/**
 * The caller's subscription tier, as the SERVER reports it.
 *
 * Deliberately not read from a store receipt or the RevenueCat client SDK.
 * The tier that decides what someone may actually spend lives in the aiUsage
 * document and is only ever written server-side — see the note in
 * functions/src/quota/check.ts — so reading it from the same response that
 * carries the usage figures keeps what the badge claims and what the coach
 * enforces from ever disagreeing.
 *
 * COSTS NO EXTRA REQUEST. ChatProvider calls useChatBox at the provider level
 * and wraps every tab screen, so this query is already in flight wherever a
 * badge can render; sharing its key subscribes to that cache entry rather than
 * fetching again.
 *
 * Returns "free" for every user today, because nothing writes a paid tier
 * until the RevenueCat extension is installed. The value of reading it now
 * rather than hardcoding it is that turning subscriptions on then needs no
 * change here at all.
 */
export function useSubscriptionTier(): SubscriptionTier {
  const { data } = useQuery(aiUsageQueryOptions());

  // Optional-chained rather than destructured, because the persisted cache can
  // rehydrate a bare number written by a build from before this endpoint
  // returned an object. Reading `tier` off it yields undefined instead of
  // throwing, and the fallback covers it until the refetch lands.
  return data?.tier ?? FALLBACK_TIER;
}
