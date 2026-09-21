import { ProgramSchema, SubscriptionTierSchema } from "@/types/types";
import { z } from "zod";

import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";

const REGION = "europe-west2";

/**
 * Everything the server tells us about our own allowance.
 *
 * `tier` is parsed through the app's own SubscriptionTierSchema rather than a
 * loose string, so a tier the app does not understand fails loudly here
 * instead of quietly reaching the UI. The server and this schema have to agree
 * word for word — that is the whole reason the server's vocabulary was changed
 * from "premium" to match this one.
 *
 * `resetsAt` is nullable because a paid document whose RevenueCat webhook has
 * not landed yet genuinely has no known reset date. Rendering nothing is the
 * honest answer; inventing a date would promise something nobody told us.
 */
export const AiUsageSchema = z.object({
  percentUsed: z.number(),
  resetsAt: z.iso.datetime().nullable(),
  tier: SubscriptionTierSchema,
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
    getFunctions(getApp(), REGION),
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
    getFunctions(getApp(), REGION),
    "getUsagePercentage",
  );

  const result = await aiUsage();

  return AiUsageSchema.parse(result.data);
};
