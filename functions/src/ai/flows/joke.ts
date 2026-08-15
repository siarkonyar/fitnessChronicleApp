import { ai, z } from "../genkit.js";

/**
 * A throwaway flow that exists only to prove three things work before any
 * coach logic depends on them:
 *
 *   1. the Genkit SDK is wired up correctly
 *   2. the Gemini API key in Secret Manager is valid and reaches the model
 *   3. token usage is readable from the response
 *
 * (3) matters most. Step 6 gates users on raw token counts, so a usage figure
 * we cannot read is a quota we cannot enforce. Better to find that out now
 * than after the tool loop exists.
 */
export const tellJokeFlow = ai.defineFlow(
  {
    name: "tellJoke",
    inputSchema: z.object({
      subject: z.string().default("squats"),
    }),
    outputSchema: z.object({
      joke: z.string(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      thoughtsTokens: z.number(),
      totalTokens: z.number(),
    }),
  },
  async ({ subject }) => {
    const response = await ai.generate(
      `Tell me one short joke about ${subject}.`
    );

    const usage = response.usage;

    return {
      joke: response.text,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      thoughtsTokens: usage?.thoughtsTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    };
  }
);
