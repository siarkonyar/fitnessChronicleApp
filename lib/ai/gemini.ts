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

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const GEMINI_MODEL = "gemini-3.6-flash";

const SYSTEM_INSTRUCTION = `You are the AI coach inside Hercule, a workout tracking app.

Help with training, technique, programming, and nutrition.

Rules:
- Keep answers short. This is a phone screen, so aim for a few sentences.
- Use plain text. No markdown headers, no bold, no tables.
- Be direct and practical. Skip the preamble.
- If asked about injuries, pain, or medical issues, tell them to see a doctor or physio.
- You cannot see their logged workouts yet, so don't pretend to.`;

let cachedModel: GenerativeModel | null = null;

const getChatModel = (): GenerativeModel => {
  if (cachedModel) return cachedModel;

  const ai = getAI(getApp(), {
    backend: new GoogleAIBackend(),
    appCheck: appCheck(),
  });

  cachedModel = getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

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
