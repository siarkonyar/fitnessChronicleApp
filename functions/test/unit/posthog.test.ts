import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { captureAiGeneration, captureAiToolRun, flushAiObservability, getAiObservabilityContext } from "../../src/ai/posthog.js";
import { userDoc } from "../../src/data/firestore.js";

const sdk = vi.hoisted(() => {
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", "test-token");
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  return { capture: vi.fn(), flush: vi.fn(), get: vi.fn() };
});
vi.mock("posthog-node", () => ({ PostHog: class { capture = sdk.capture; flush = sdk.flush; } }));
vi.mock("../../src/data/firestore.js", () => ({ userDoc: vi.fn(() => ({ get: sdk.get })) }));

const context = { distinctId: "verified-user", traceId: "trace", sessionId: "session" };
beforeEach(() => {
  vi.clearAllMocks();
  sdk.capture.mockReset();
  sdk.flush.mockResolvedValue(undefined);
});
afterAll(() => vi.unstubAllEnvs());

describe("PostHog AI telemetry", () => {
  it.each([false, undefined, "true"])("requires an explicit stored consent of true (%s)", async (analyticsConsent) => {
    sdk.get.mockResolvedValue({ data: () => ({ analyticsConsent }) });
    expect(await getAiObservabilityContext("verified-user", "conversation")).toBeUndefined();
  });

  it("uses the verified account and separates identical conversation IDs between accounts", async () => {
    sdk.get.mockResolvedValue({ data: () => ({ analyticsConsent: true }) });
    expect(await getAiObservabilityContext("verified-user", "conversation")).toMatchObject({ distinctId: "verified-user", sessionId: "verified-user:conversation", traceId: expect.any(String) });
    expect(userDoc).toHaveBeenCalledWith("verified-user");
    expect(await getAiObservabilityContext("other-user", "conversation")).toMatchObject({ sessionId: "other-user:conversation" });
    expect(await getAiObservabilityContext("verified-user")).toMatchObject({ sessionId: null });
  });

  it("disables telemetry when the consent read fails", async () => {
    sdk.get.mockRejectedValue(new Error("unavailable"));
    expect(await getAiObservabilityContext("verified-user")).toBeUndefined();
  });

  it("sends usage metadata and omits prompt and tool data", async () => {
    captureAiGeneration(context, { model: "test-model", latencyMs: 1500, inputTokens: 10, outputTokens: 20, totalTokens: 40 });
    const output = { workouts: "private workout data", notes: "private note" };
    expect(await captureAiToolRun(context, "getWorkoutLogs", async () => output)).toBe(output);
    expect(sdk.capture.mock.calls[0][0]).toMatchObject({ distinctId: "verified-user", event: "$ai_generation", properties: { $ai_latency: 1.5, $ai_total_tokens: 40, $ai_span_id: expect.any(String) } });
    const sent = JSON.stringify(sdk.capture.mock.calls);
    expect(sent).not.toContain("private");
    for (const [event] of sdk.capture.mock.calls) {
      for (const key of ["$ai_input", "$ai_output_choices", "$ai_input_state", "$ai_output_state"]) {
        expect(event.properties).not.toHaveProperty(key);
      }
    }
  });

  it("SDK failure cannot fail a successful tool or replace a tool error", async () => {
    sdk.capture.mockImplementation(() => { throw new Error("SDK failed"); });
    expect(await captureAiToolRun(context, "getLabels", async () => "result")).toBe("result");
    const error = new Error("private failure details");
    await expect(captureAiToolRun(context, "getLabels", async () => { throw error; })).rejects.toBe(error);
  });

  it("reports static failure details and swallows flush failures", async () => {
    const error = new Error("private failure details");
    await expect(captureAiToolRun(context, "getLabels", async () => { throw error; })).rejects.toBe(error);
    expect(sdk.capture).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ $ai_is_error: true, $ai_error: "Tool execution failed" }) }));
    expect(JSON.stringify(sdk.capture.mock.calls)).not.toContain(error.message);
    sdk.flush.mockRejectedValue(new Error("network"));
    await expect(flushAiObservability()).resolves.toBeUndefined();
  });
});
