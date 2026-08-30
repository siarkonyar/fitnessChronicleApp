import type { Program } from "../../data/schemas.js";
import {
  CoachRequestSchema,
  CoachResultSchema,
  MAX_HISTORY_MESSAGES,
} from "../../types.js";
import { ai } from "../genkit.js";
import { toProgram } from "../programDraft.js";
import { buildSystemInstruction } from "../prompt.js";
import { coachTools } from "../tools.js";

/** Ported from useChatBox.ts:21. Used when the model returns no text at all. */
const FALLBACK_REPLY =
  "Sorry, I couldn't work that one out. Try asking a different way.";

/** Ported from useChatBox.ts:26, for when a program arrives with no text. */
const PROGRAM_FALLBACK_REPLY =
  "Here's a program to look over. Tell me what you'd change.";

/**
 * Stops a model that keeps asking for tools from spending forever.
 * Ported from MAX_TOOL_ROUNDS in useChatBox.ts:19.
 */
const MAX_TOOL_ROUNDS = 5;

/**
 * Finds the program the model proposed, if it proposed one.
 *
 * The proposeProgram tool returns only a summary to the model, so the real
 * Program is rebuilt here from the arguments the model sent — the same thing
 * useChatBox.ts:73 did with call.args. Rebuilding is deterministic, and it
 * keeps the full program out of the model's context where it would only cost
 * tokens.
 *
 * The last call wins: if the model revises its proposal within one turn, the
 * user should see the revision.
 */
const extractProposedProgram = (
  messages: readonly { role: string; content: readonly unknown[] }[],
  prefs: { repType: "fixed" | "range"; measure: "kg" | "lbs" },
): Program | undefined => {
  let program: Program | undefined;

  for (const message of messages) {
    for (const part of message.content) {
      const request = (
        part as { toolRequest?: { name?: string; input?: unknown } }
      ).toolRequest;

      if (request?.name !== "proposeProgram") continue;

      // Arguments the tool already rejected rebuild to null here too, so a
      // failed proposal never reaches the user as a half-built program.
      program = toProgram(request.input, prefs) ?? program;
    }
  }

  return program;
};

/**
 * One coach turn: system instruction + trimmed history + the new message,
 * with the four tools available.
 *
 * This replaces runCoachTurn in hooks/useChatBox.ts:49. The hand-rolled tool
 * loop and its role:"function" workaround are gone — Genkit owns the loop.
 *
 * uid and prefs travel in Genkit context, which propagates to the tools. The
 * model never sees either, so it cannot be talked into reading another user's
 * data or overriding their unit preference.
 */
export const coachFlow = ai.defineFlow(
  {
    name: "coach",
    inputSchema: CoachRequestSchema,
    outputSchema: CoachResultSchema,
  },
  async ({ message, history, today, prefs }) => {
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
      tools: coachTools,
      maxTurns: MAX_TOOL_ROUNDS,
      config: { thinkingConfig: { thinkingLevel: "MINIMAL" } }, //"MINIMAL" | "LOW" | "MEDIUM" | "HIGH"
    });

    const program = extractProposedProgram(response.messages, prefs);

    // Empty text happens when the model spent its last turn calling tools.
    const fallback = program ? PROGRAM_FALLBACK_REPLY : FALLBACK_REPLY;

    return {
      reply: response.text || fallback,
      ...(program && { program }),
      // totalTokens, not input + output: gemini-3.6-flash bills thinking
      // tokens, which were 93-97% of every call measured at step 3.
      totalTokens: response.usage?.totalTokens ?? 0,
    };
  },
);
