import { FUNCTIONS_REGION } from "@/constants/firebase";
import { ProgramSchema, SubscriptionTierSchema } from "@/types/types";
import { z } from "zod";

import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";

/**
 * Everything the server tells us about our own allowance.
 *
 * `resetsAt` is nullable because a paid document whose RevenueCat webhook has
 * not landed yet genuinely has no known reset date. Rendering nothing is the
 * honest answer; inventing a date would promise something nobody told us.
 *
 * LENIENT WHERE BEING WRONG IS CHEAP. An installed build lives for months, and
 * the server will learn words this build never will. A tier it does not know
 * reads as "free" — the same direction as the server's parseTier — rather than
 * throwing, because a throw here fails a coach reply that was already billed.
 * The plan-card fields read as null when missing or unknown, so this build
 * also works against a server that has not been deployed yet.
 */
export const AiUsageSchema = z.object({
  percentUsed: z.number(),
  resetsAt: z.iso.datetime().nullable(),
  tier: SubscriptionTierSchema.catch("free"),
  activeUntil: z.iso.datetime().nullable().catch(null),
  billingPeriod: z.enum(["monthly", "yearly"]).nullable().catch(null),
});

export type AiUsage = z.infer<typeof AiUsageSchema>;

/**
 * A coach reply carries a full, fresh copy of the usage figures, so the caller
 * can drop it straight into the cache instead of merging a partial update.
 */
export const CoachResponseSchema = AiUsageSchema.extend({
  reply: z.string(),
  program: ProgramSchema.optional(),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

export interface CoachPrefs {
  repType: "fixed" | "range";
  measure: "kg" | "lbs";
}

export interface CoachHistoryMessage {
  role: "user" | "model";
  text: string;
}

export interface CoachRequest {
  message: string;
  history: CoachHistoryMessage[];
  today: string;
  prefs: CoachPrefs;
}

export const callCoach = async (
  request: CoachRequest,
): Promise<CoachResponse> => {
  const coach = httpsCallable<CoachRequest, unknown>(
    getFunctions(getApp(), FUNCTIONS_REGION),
    "chatWithCoach",
  );

  const result = await coach(request);

  return CoachResponseSchema.parse(result.data);
};

/**
 * The callable is still named getUsagePercentage on the server, though it now
 * answers the whole allowance question. Renaming it would orphan the deployed
 * function until someone deleted it by hand.
 */
export const callAiUsage = async (): Promise<AiUsage> => {
  const aiUsage = httpsCallable<undefined, unknown>(
    getFunctions(getApp(), FUNCTIONS_REGION),
    "getUsagePercentage",
  );

  const result = await aiUsage();

  return AiUsageSchema.parse(result.data);
};
