import { ProgramSchema } from "@/types/types";
import { z } from "zod";

import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";

const REGION = "europe-west2";

export const CoachResponseSchema = z.object({
  reply: z.string(),
  program: ProgramSchema.optional(),
  percentUsed: z.number(),
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

export const callUsagePercentage = async (): Promise<number> => {
  const usagePercentage = httpsCallable<undefined, unknown>(
    getFunctions(getApp(), REGION),
    "getUsagePercentage",
  );

  const result = await usagePercentage();

  return z.number().parse(result.data);
};
