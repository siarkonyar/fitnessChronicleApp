import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "firebase-functions";
import { ai } from "../../src/ai/genkit.js";
import { coachFlow } from "../../src/ai/flows/coach.js";
import { MAX_HISTORY_MESSAGES } from "../../src/types.js";
import { captureAiGeneration } from "../../src/ai/posthog.js";

// Keep real Genkit flow/tool registration and schema validation. Only the
// external generation boundary is replaced; no model or network is used.
vi.mock("../../src/ai/genkit.js", async () => {
  const { genkit } = await import("genkit");
  const ai = genkit({ plugins: [] });
  ai.generate = vi.fn();
  return { ai, COACH_MODEL: "test-model", COACH_THINKING_LEVEL: "minimal" };
});
vi.mock("../../src/data/exerciseLogs.js", () => ({ getExerciseLogsByDateRange: vi.fn() }));
vi.mock("../../src/data/labels.js", () => ({ getAllLabels: vi.fn() }));
vi.mock("../../src/data/programs.js", () => ({ getPrograms: vi.fn() }));
vi.mock("firebase-functions", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../../src/ai/posthog.js", async (importOriginal) => ({ ...await importOriginal<object>(), captureAiGeneration: vi.fn() }));

const request = () => ({ message: "Build a plan", today: "2026-10-05", history: [], prefs: { repType: "range", measure: "lbs" } as const });
const proposal = (name: string) => ({ name, days: [{ isRestDay: false, exercises: [{ activity: "Bench press", sets: [{ setType: "normal", reps: "8" }] }] }] });
const toolPart = (name: string, input: unknown) => ({ toolRequest: { name, input } });
const respond = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(ai.generate).mockResolvedValue({ text: "Keep going", messages: [], usage: { totalTokens: 1000, inputTokens: 100, outputTokens: 200, thoughtsTokens: 700 }, ...overrides } as never);
};

beforeEach(() => { vi.clearAllMocks(); respond(); });

describe("coach flow", () => {
  it("records failed generation metadata and preserves the provider error", async () => {
    const error = new Error("Private provider error");
    vi.mocked(ai.generate).mockRejectedValue(error);
    const aiObservability = { distinctId: "user", traceId: "trace", sessionId: "session" };
    await expect(coachFlow(request(), { context: { aiObservability } })).rejects.toThrow(error.message);
    expect(captureAiGeneration).toHaveBeenCalledWith(aiObservability, {
      model: "test-model", latencyMs: expect.any(Number), inputTokens: 0,
      outputTokens: 0, totalTokens: 0, failed: true,
    });
    expect(JSON.stringify(vi.mocked(captureAiGeneration).mock.calls)).not.toContain(error.message);
  });
  it("trims history before generation and sends the new message exactly once", async () => {
    const history = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({ role: "user" as const, text: `history-${i}` }));
    await coachFlow({ ...request(), history });
    const options = vi.mocked(ai.generate).mock.calls[0][0] as { messages: unknown[]; prompt: string; maxTurns: number; system: string };
    expect(options.messages).toEqual(history.slice(-MAX_HISTORY_MESSAGES).map(({ role, text }) => ({ role, content: [{ text }] })));
    expect(options.prompt).toBe("Build a plan");
    expect(options.maxTurns).toBe(5);
    expect(options.system).toContain("2026-10-05");
  });

  it("meters total tokens including thinking, rather than input plus output", async () => {
    expect(await coachFlow(request())).toMatchObject({ reply: "Keep going", totalTokens: 1000, inputTokens: 100, outputTokens: 200, thoughtsTokens: 700, toolCalls: [], usedFallbackReply: false });
  });

  it("defaults absent SDK usage to zero", async () => {
    respond({ usage: undefined });
    expect(await coachFlow(request())).toMatchObject({ totalTokens: 0, inputTokens: 0, outputTokens: 0, thoughtsTokens: 0 });
  });

  it("keeps the last valid proposal and preserves repeated tool names in order", async () => {
    respond({ messages: [{ role: "model", content: [
      toolPart("getLabels", {}), toolPart("proposeProgram", proposal("First")),
      toolPart("getLabels", {}), toolPart("proposeProgram", proposal("Revision")),
      toolPart("proposeProgram", { name: "Invalid", days: [] }),
    ] }] });
    const result = await coachFlow(request());
    expect(result.program?.name).toBe("Revision");
    expect(result.program?.days[0].exercises?.[0].sets).toEqual([{ measure: "lbs", setType: "normal", reps: "7-8" }]);
    expect(result.toolCalls).toEqual(["getLabels", "proposeProgram", "getLabels", "proposeProgram", "proposeProgram"]);
    expect(logger.warn).toHaveBeenCalledWith("Coach proposed a program that failed validation", expect.any(Object));
  });

  it.each([false, true])("uses the appropriate empty-text fallback (program=%s)", async (hasProgram) => {
    respond({ text: "", messages: hasProgram ? [{ role: "model", content: [toolPart("proposeProgram", proposal("Plan"))] }] : [] });
    const result = await coachFlow(request());
    expect(result.usedFallbackReply).toBe(true);
    expect(result.reply).toBe(hasProgram ? "Here's a program to look over. Tell me what you'd change." : "Sorry, I couldn't work that one out. Try asking a different way.");
    expect(logger.warn).toHaveBeenCalledWith("Coach returned no text, substituted fallback reply", expect.objectContaining({ hasProgram }));
  });

  it("rejects malformed flow input before generation", async () => {
    await expect(coachFlow({ ...request(), message: "" })).rejects.toThrow();
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it("propagates provider failure without inventing a successful result", async () => {
    vi.mocked(ai.generate).mockRejectedValue(new Error("Provider unavailable"));
    await expect(coachFlow(request())).rejects.toThrow("Provider unavailable");
  });
});
