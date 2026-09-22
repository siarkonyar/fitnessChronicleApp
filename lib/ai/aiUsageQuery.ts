import { queryKeys } from "@/constants/QueryKeys";
import { queryOptions } from "@tanstack/react-query";
import { callAiUsage } from "./coachServer";

/**
 * The one definition of the AI usage query.
 *
 * WHY THIS IS SHARED RATHER THAN DECLARED TWICE. Both useChatBox and
 * useSubscriptionTier read the same cache entry, and TanStack Query resolves a
 * key declared twice with differing options by whichever observer mounted
 * first. Two inline copies agree today; the moment one grows a `select` or a
 * different staleTime, the other silently gets behaviour it never asked for
 * and the bug depends on render order. Exactly the drift this codebase spent
 * the tier-vocabulary work eliminating elsewhere.
 *
 * staleTime 0 overrides the global five-minute default on purpose: the
 * allowance can move on another device, and a figure rehydrated from
 * AsyncStorage should never outlive a single open of the screen.
 *
 * Sharing the key also means the tier badge costs no extra request —
 * ChatProvider already has this query in flight wherever a badge can render.
 */
export const aiUsageQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.aiUsage.all,
    queryFn: callAiUsage,
    staleTime: 0,
  });
