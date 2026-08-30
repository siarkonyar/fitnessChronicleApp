import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

/**
 * The model the coach runs on.
 *
 * Matches GEMINI_MODEL in lib/ai/gemini.ts:17, so moving the coach to the
 * server does not silently change which model answers the user.
 */
export const COACH_MODEL = "gemini-3.1-flash-lite";

/**
 * How hard the model is allowed to think before answering.
 *
 * One of "MINIMAL" | "LOW" | "MEDIUM" | "HIGH". This is the single most
 * expensive setting in the codebase: thinking tokens bill as output and ran to
 * 93-97% of every call measured on the previous model, which is why the quota
 * meters total tokens rather than input plus output (see quota/caps.ts).
 *
 * A named constant rather than a literal in the generate call because two
 * places need it — coach.ts applies it, and the per-turn log records it. A
 * second copy would keep reporting the old level the moment either changed,
 * making the cost history quietly wrong exactly when it was most interesting.
 */
export const COACH_THINKING_LEVEL = "MINIMAL";//"MINIMAL" | "LOW" | "MEDIUM" | "HIGH"

/**
 * The single Genkit instance for this codebase.
 *
 * googleAI() reads the API key from the GEMINI_API_KEY environment variable.
 * In Cloud Functions that variable is populated by Secret Manager, because the
 * function declares `secrets: [geminiApiKey]`. Locally the Genkit dev UI reads
 * it from the shell. Either way the key is never in source.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(COACH_MODEL),
});

/**
 * Re-exported deliberately.
 *
 * This `z` is zod 3, vendored under @genkit-ai/core — NOT the zod 4 at the top
 * of functions/node_modules that matches the app's types/types.ts. Genkit
 * schemas built with the wrong instance fail at runtime, so every flow and tool
 * in this codebase must import z from here.
 */
export { z };
