import { ChatMessageSchema } from "@/types/types";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type ChatSession,
  type GenerativeModel,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";
import appCheck from "@react-native-firebase/app-check";
import { z } from "zod";
import { getTodayString } from "../dateUtils";
import { coachTools } from "./coachTools";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const GEMINI_MODEL = "gemini-3.6-flash";

const buildSystemInstruction = (today: string): string =>
  `You are the AI coach inside Hercule, a workout tracking app.

Help with training, technique, programming, and nutrition.

Today is ${today}. Work out any date ranges yourself from that.

You can read this user's own training data:
- getWorkoutLogs(startDate, endDate) for what they actually logged
- getLabels() for their workout day labels, e.g. Push, Pull, Legs
- getPrograms() for their saved program templates

Rules:
- Keep answers short. This is a phone screen, so aim for a few sentences.
- Use plain text. No markdown headers, no bold, no tables.
- Be direct and practical. Skip the preamble.
- When the question is about their own training, call a tool. Never guess their numbers.
- Don't call tools for general questions about technique or nutrition.
- If a tool returns nothing, say so plainly. Never invent workouts they did not log.
- If asked about injuries, pain, or medical issues, tell them to see a doctor or physio.`;

let cachedModel: GenerativeModel | null = null;
let cachedModelDate = "";

const getChatModel = (): GenerativeModel => {
  const today = getTodayString();

  // The system instruction embeds today's date, so a model built yesterday is
  // stale. Rebuild when the date rolls over under a long-running app.
  if (cachedModel && cachedModelDate === today) return cachedModel;

  const ai = getAI(getApp(), {
    backend: new GoogleAIBackend(),
    appCheck: appCheck(),
  });

  cachedModel = getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    systemInstruction: buildSystemInstruction(today),
    tools: coachTools,
  });
  cachedModelDate = today;

  return cachedModel;
};

export const startChatSession = (history: ChatMessage[]): ChatSession => {
  return getChatModel().startChat({
    history: history.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
  });
};
