/**
 * The analytics event schema. One place to read what the app reports.
 *
 * Names are written as literal strings rather than exported constants on
 * purpose. The map below turns every name into part of a union, so a typo at a
 * call site is a compile error and the params for that specific event are
 * checked too — which a bag of `const AI_MESSAGE_SENT = "..."` constants
 * cannot do. There is exactly one place to change a name: here.
 *
 * PRIVACY RULE, applies to every event: counts, enums, and booleans only.
 * Never a message the user typed, an exercise name, a label, a weight, an
 * email, or any other free text. If a param cannot be satisfied by a number or
 * a fixed set of strings, it does not belong in analytics.
 *
 * GA4 constraints the client enforces (see client.ts): event names are
 * <=40 chars matching [a-z][a-z0-9_]*, at most 25 params per event, param
 * names <=40 chars, and string values are truncated at 100 chars.
 */

/** Mirrors the measure union in SetSchema (types/types.ts:19-46). */
type ExerciseMeasure = "kg" | "lbs" | "time" | "distance" | "steps";

/** Mirrors WeightMeasureSchema (types/types.ts:104). */
type WeightMeasure = "kg" | "lbs";

/** Which affordance produced a coach message. */
type AiMessageSource = "composer" | "pill" | "regenerate";

/**
 * Why a coach turn failed.
 *
 * Deliberately mirrors the split useChatBox already makes: the server sends
 * quota and rate limit as the same resource-exhausted code and separates them
 * with details.reason, and offline is handled by useServerErrorHandler before
 * the banner ever shows. Collapsing them here would hide the one distinction
 * that matters — quota is terminal for the period, a rate limit clears itself.
 */
type AiFailureReason = "quota" | "rate_limit" | "offline" | "unknown";

/**
 * Every event, with its exact params.
 *
 * `login` and `sign_up` are GA4's own recommended event names. Using the
 * reserved spelling is what puts them into the built-in acquisition and
 * engagement reports instead of stranding them as custom events.
 */
export type AnalyticsEventMap = {
  // ---- AI coach -----------------------------------------------------------
  ai_chat_opened: { percent_used: number };
  ai_message_sent: {
    source: AiMessageSource;
    message_length: number;
    history_length: number;
  };
  ai_response_received: {
    latency_ms: number;
    has_program: boolean;
    percent_used: number;
  };
  ai_response_failed: { reason: AiFailureReason; latency_ms: number };
  ai_chat_cleared: { message_count: number };
  ai_suggestion_tapped: { suggestion_index: number };
  ai_program_accepted: { day_count: number; labels_created: number };
  ai_program_accept_failed: Record<string, never>;
  ai_program_regenerated: Record<string, never>;
  /** The silent early return in handleSend — invisible before this event. */
  ai_send_blocked: { reason: "sending" | "quota" };

  // ---- Auth ---------------------------------------------------------------
  login: { method: "google" | "apple" };
  sign_up: { method: "google" | "apple" };
  logout: Record<string, never>;
  account_delete_started: Record<string, never>;
  account_deleted: Record<string, never>;

  // ---- Exercise -----------------------------------------------------------
  exercise_logged: {
    measure: ExerciseMeasure;
    set_count: number;
    source: "online" | "offline";
  };
  exercise_edited: { measure: ExerciseMeasure; set_count: number };
  exercise_deleted: Record<string, never>;

  // ---- Programs and labels ------------------------------------------------
  program_created: { day_count: number; source: "manual" | "ai" };
  program_selected: Record<string, never>;
  program_edited: { day_count: number };
  program_deleted: Record<string, never>;
  label_created: Record<string, never>;
  label_assigned: Record<string, never>;

  // ---- Body weight --------------------------------------------------------
  weight_logged: { measure: WeightMeasure };

  // ---- Offline ------------------------------------------------------------
  offline_mode_entered: Record<string, never>;
  offline_sync_completed: { synced_count: number };

  // ---- Settings -----------------------------------------------------------
  /** `value` is stringified enum/boolean state, never free text. */
  settings_changed: { setting: string; value: string };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
