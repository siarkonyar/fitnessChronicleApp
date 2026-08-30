import { logger } from "firebase-functions";
import type { Tier } from "../quota/caps.js";

/**
 * How a turn ended.
 *
 * "ok" is a turn the model answered. The other three never reached the model,
 * and telling them apart is most of the value here: a wall of "quota" says the
 * free tier is too small, a wall of "rate_limit" says something is hammering
 * the endpoint, and "error" says we are paying for failures.
 */
export type TurnOutcome = "ok" | "quota" | "rate_limit" | "error";

export interface TurnRecord {
  uid: string;
  outcome: TurnOutcome;
  tier: Tier;
  /** Characters in the user's message. The message itself is never recorded. */
  messageChars: number;
  historyLength: number;
  /** Everything below is absent on a turn that never reached the model. */
  model?: string;
  thinkingLevel?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
  latencyMs?: number;
  toolCalls?: readonly string[];
  hasProgram?: boolean;
  usedFallbackReply?: boolean;
}

/**
 * Records one coach turn to Cloud Logging.
 *
 * Logs, and nothing else. An earlier draft also wrote a document per turn to
 * Firestore; that was dropped because it stored the same data twice in a
 * database that cannot answer the questions this data exists for. "Tokens per
 * day", "most expensive turns", "average tool calls" are all aggregations, and
 * aggregating in Firestore means reading every document. When that history is
 * genuinely wanted, the answer is a BigQuery sink on these very log lines —
 * which needs no code change here at all.
 *
 * The fields go in as structured data rather than an interpolated string, so
 * each one lands in jsonPayload and can be filtered on its own:
 *
 *   jsonPayload.event="ai_turn" AND jsonPayload.outcome="quota"
 *   jsonPayload.event="ai_turn" AND jsonPayload.totalTokens>20000
 *
 * Counts and enums only. The message text, exercise names, labels and weights
 * never appear — only how long the message was.
 *
 * Safe to call on every path including rate limits, precisely because it does
 * not write to Firestore. A write per rejected request would have handed
 * whoever is flooding us control of the bill, which is the same reason
 * checkQuota deliberately writes nothing there (quota/check.ts:173-180).
 */
export const recordTurn = (record: TurnRecord): void => {
  const toolCalls = record.toolCalls ?? [];

  logger.info("ai_turn", {
    // Repeated as a field so Log Explorer can filter on it. The message text
    // above is not queryable structured data.
    event: "ai_turn",
    ...record,
    toolCalls: [...toolCalls],
    // Precomputed because log queries cannot measure array length.
    toolCallCount: toolCalls.length,
  });
};
