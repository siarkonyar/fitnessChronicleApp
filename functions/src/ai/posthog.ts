import { randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";
import { userDoc } from "../data/firestore.js";

const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;

/** Missing settings disable telemetry. They must not stop a function. */
export const posthog = projectToken && host
  ? new PostHog(projectToken, {
      host,
      privacyMode: true,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3000,
      fetchRetryCount: 0,
    })
  : undefined;

export interface AiObservabilityContext {
  distinctId?: string;
  sessionId: string | null;
  traceId: string;
}

export const createAiTraceId = (): string => randomUUID();

/** Use the verified UID and the stored consent, never a client-supplied UID. */
export const getAiObservabilityContext = async (
  uid: string,
  conversationId?: string,
): Promise<AiObservabilityContext | undefined> => {
  if (!posthog) return undefined;
  try {
    const snapshot = await userDoc(uid).get();
    if (snapshot.data()?.analyticsConsent !== true) return undefined;
    return {
      distinctId: uid,
      // An old client has no conversation boundary. Do not merge users by PID.
      sessionId: conversationId ? `${uid}:${conversationId}` : null,
      traceId: createAiTraceId(),
    };
  } catch {
    // A failed consent read disables telemetry, not the coach.
    return undefined;
  }
};

const capture = (
  context: AiObservabilityContext,
  event: string,
  properties: Record<string, unknown>,
): void => {
  try {
    posthog?.capture({
      distinctId: context.distinctId ?? context.traceId,
      event,
      properties: {
        $ai_trace_id: context.traceId,
        $ai_session_id: context.sessionId,
        $ai_span_id: randomUUID(),
        ...properties,
      },
    });
  } catch {
    // Telemetry must not change a result or replace the original error.
  }
};

/** Send usage metadata only. Do not send prompts, replies, or workout data. */
export const captureAiGeneration = (
  context: AiObservabilityContext,
  properties: {
    model: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    failed?: boolean;
  },
): void => {
  capture(context, "$ai_generation", {
    $ai_provider: "google",
    $ai_model: properties.model,
    $ai_latency: properties.latencyMs / 1000,
    $ai_input_tokens: properties.inputTokens,
    $ai_output_tokens: properties.outputTokens,
    $ai_total_tokens: properties.totalTokens,
    ...(properties.failed && {
      $ai_is_error: true,
      $ai_error: "Generation failed",
    }),
  });
};

export const captureAiToolRun = async <T>(
  context: AiObservabilityContext | undefined,
  name: string,
  run: () => Promise<T>,
): Promise<T> => {
  if (!context) return run();
  const startedAt = Date.now();
  const properties = () => ({
    $ai_span_name: name,
    $ai_latency: (Date.now() - startedAt) / 1000,
  });

  try {
    const output = await run();
    capture(context, "$ai_span", properties());
    return output;
  } catch (error) {
    capture(context, "$ai_span", {
      ...properties(),
      $ai_is_error: true,
      $ai_error: "Tool execution failed",
    });
    throw error;
  }
};

export const flushAiObservability = async (): Promise<void> => {
  try {
    await posthog?.flush();
  } catch {
    // Telemetry must not change the coach turn's outcome.
  }
};
