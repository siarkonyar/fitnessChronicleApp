import { ChatMessageSchema } from "@/types/types";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type Content,
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

Building a program:
- Never propose until you know their goal and how many days a week they train.
- Ask one or two questions per message, and don't spend more than two or three messages asking.
- Call getLabels() first. If one of their labels fits a day, reuse its description exactly and copy its emoji.
- Programs are sets and reps only. Never write weights, never "3x8 @ 60kg". If they ask for weights, say the program is a plan and they log the load as they go.
- After calling proposeProgram, write one short sentence. They can see the program, so don't list it back to them.

Rule by rule:

- "Never propose until you know their goal and days per week." Without this the model proposes on the first message, from nothing. The tool description says this too — belt and braces, because the description is read when it's considering the call and the system prompt shapes the conversation leading up to it.
- "One or two questions per message… two or three messages." Two failure modes, opposite directions. Unbounded questioning turns a program request into an interrogation; a single question dump is a wall of text on a phone. This bounds both ends.
- "Call getLabels() first… reuse its description exactly." Labels match on description (§03). If the user already has a "Push" label and the model invents "Push Day", they end up with two labels that mean the same thing. copy its emoji matters too — emoji are decorative, so inventing a new one for an existing label looks like a different label to the user.
- "Sets and reps only… never 3x8 @ 60kg." The concrete counter-example is doing the work here. Never write weights alone is abstract; the model has seen a million programs written in exactly that notation, and naming the format it must not use is far more reliable than naming the concept.
- "…they log the load as they go." Gives the model something to say instead of just something to refuse. A rule with no alternative produces an apologetic non-answer.
- "After calling proposeProgram, write one short sentence." The trap from the plan: the model's instinct after a tool call is to summarise what it just did. Here the card already shows every day, every exercise, every set — so a summary is the same information twice, and on a phone that reads as a wall.

Two things this cannot do, both structural: it's built once at module load (line 51), so it can't carry the user's rep-type or measure preference — that's why toReps converts in code afterwards rather than instructing the model. And the whole string is rebuilt only when the date rolls over, so your edit needs a reload to take effect, not just a re-send.

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

export const getCoachModel = (): GenerativeModel => getChatModel();

/**
 * Our chat state -> the shape the model API takes.
 *
 * We build `Content[]` by hand rather than using `ChatSession`, because
 * ChatSession stamps function responses with `role: "function"`
 * (request-helpers.ts:65) and this backend only accepts user/model/system.
 */
export const toContents = (messages: ChatMessage[]): Content[] =>
  messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
