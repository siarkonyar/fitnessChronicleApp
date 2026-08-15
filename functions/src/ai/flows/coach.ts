import { ai } from "../genkit.js";
import { buildSystemInstruction } from "../prompt.js";
import {
  CoachRequestSchema,
  CoachResultSchema,
  MAX_HISTORY_MESSAGES,
} from "../../types.js";

/** Ported from useChatBox.ts:21. Used when the model returns no text at all. */
const FALLBACK_REPLY =
  "Sorry, I couldn't work that one out. Try asking a different way.";

/**
 * One coach turn: system instruction + trimmed history + the new message.
 *
 * This replaces runCoachTurn in hooks/useChatBox.ts:49. The hand-rolled tool
 * loop there — and its `role: "function"` workaround — are gone: Genkit runs
 * the tool loop itself. Tools arrive at step 5; this step only proves the
 * coach talks.
 */
export const coachFlow = ai.defineFlow(
  {
    name: "coach",
    inputSchema: CoachRequestSchema,
    outputSchema: CoachResultSchema,
  },
  async ({ message, history, today }) => {
    // Trimmed here rather than in the callable so the cap cannot be bypassed
    // by any other caller of this flow, including the Genkit dev UI.
    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    const response = await ai.generate({
      system: buildSystemInstruction(today),
      // content is Part[], not a string. The docs show a bare string, but the
      // types require the array form and that is what the SDK actually takes.
      messages: recent.map((entry) => ({
        role: entry.role,
        content: [{ text: entry.text }],
      })),
      prompt: message,
    });

    return {
      // Empty text is possible — at step 5 it will mean "asked for a tool and
      // nothing else", which is exactly when the user must still see something.
      reply: response.text || FALLBACK_REPLY,
      // totalTokens, not input + output: gemini-3.6-flash bills thinking
      // tokens, which were 93-97% of every call measured at step 3.
      totalTokens: response.usage?.totalTokens ?? 0,
    };
  }
);
