// Schemas for the coach request and response.
//
// `z` comes from "genkit", which is zod 3 — NOT the zod 4 at the top of
// functions/node_modules. Genkit flow schemas must be built with its own
// instance, and one zod on the server beats two.
import { z } from "genkit";

/**
 * How many past messages we keep.
 *
 * The client sends the history each call, so without a cap here a caller could
 * send ten thousand messages and bill us for the context. Applied server-side
 * precisely because the client's number cannot be trusted.
 */
export const MAX_HISTORY_MESSAGES = 20;

/** Longest single message we will accept, in characters. */
export const MAX_MESSAGE_CHARS = 2000;

/**
 * A date the user's device considers "today", as YYYY-MM-DD.
 *
 * The system instruction embeds this and tells the model to derive every date
 * range from it, so it has to be the *user's* today, not the server's. Cloud
 * Functions run in UTC; a user in Auckland at 09:00 Sunday would otherwise get
 * a coach that thinks it is Saturday, and every "last week" range would be off
 * by a day.
 *
 * Matches getTodayString() in lib/dateUtils.ts, which is
 * `new Date().toLocaleDateString("en-CA")` — device-local, YYYY-MM-DD.
 */
export const TodaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "today must be YYYY-MM-DD");

export const ChatRoleSchema = z.enum(["user", "model"]);

/** Mirrors ChatMessageSchema in types/types.ts, minus fields the server ignores. */
export const HistoryMessageSchema = z.object({
  role: ChatRoleSchema,
  text: z.string(),
});

export const CoachRequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_CHARS),
  history: z.array(HistoryMessageSchema).default([]),
  today: TodaySchema,
});

export const CoachResultSchema = z.object({
  reply: z.string(),
  /**
   * Internal only. The callable strips this before replying — the plan sends
   * the app a percentage and nothing else, never token counts and never money.
   */
  totalTokens: z.number(),
});

export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export type CoachResult = z.infer<typeof CoachResultSchema>;

/** How far the client's "today" may sit from the server's UTC date, in days. */
const MAX_TODAY_DRIFT_DAYS = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when `today` is close enough to the server's date to be a real timezone
 * difference rather than a nonsense value.
 *
 * Real offsets span UTC-12 to UTC+14, so a legitimate device is never more than
 * one calendar day from UTC either way. This does not need to be airtight: the
 * tools only ever read the caller's own data, so a bad date can only make
 * someone misread their own logs.
 */
export const isPlausibleToday = (
  today: string,
  now: Date = new Date()
): boolean => {
  const claimed = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(claimed)) return false;

  const serverMidnight = Date.parse(
    `${now.toISOString().slice(0, 10)}T00:00:00Z`
  );

  return Math.abs(claimed - serverMidnight) <= MAX_TODAY_DRIFT_DAYS * MS_PER_DAY;
};
