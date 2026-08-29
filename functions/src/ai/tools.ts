/**
 * The tools the coach can call to read the caller's own training data.
 *
 * Ported from lib/ai/coachTools.ts. Two things changed structurally:
 *
 *  - The hand-written Schema.object declarations are gone. Genkit derives the
 *    function declaration from the zod schema, so .describe() is now what the
 *    model reads.
 *  - There is no runCoachTool dispatcher. Genkit routes calls itself.
 *
 * THE SECURITY RULE OF THIS FILE: uid comes from Genkit context, never from a
 * tool argument. The Admin SDK ignores security rules, so a uid the model chose
 * would read a stranger's data — and a model can be talked into choosing one.
 * Context is a side channel the model cannot see or influence.
 */
import { z } from "genkit";
import { ai } from "./genkit.js";
import { getExerciseLogsByDateRange } from "../data/exerciseLogs.js";
import { getAllLabels } from "../data/labels.js";
import { getPrograms } from "../data/programs.js";
import { formatLabel, formatLog, formatProgram } from "./format.js";
import {
  ProgramDraftArgsSchema,
  describeProgram,
  toProgram,
  type ProgramDraftPrefs,
} from "./programDraft.js";

/** Widest range we will query at once. Ported from coachTools.ts:29. */
export const MAX_RANGE_DAYS = 366;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/** Ported from daysBetween in lib/dateUtils.ts:5, parsed as UTC. */
const daysBetween = (fromDate: string, toDate: string): number => {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
};

/**
 * The shape the callable puts into Genkit context.
 *
 * `auth.uid` follows the convention Genkit recommends for auth context, so it
 * lines up with what onCallGenkit would populate if we ever switch to it.
 */
export interface CoachContext {
  auth?: { uid?: string };
  prefs?: ProgramDraftPrefs;
}

/**
 * Pulls the caller's uid out of context, or refuses.
 *
 * Throwing here is deliberate. A tool that quietly returned "no data" when the
 * uid was missing would look identical to a user with nothing logged, and we
 * would never notice the wiring had broken.
 */
const requireUid = (context: unknown): string => {
  const uid = (context as CoachContext | undefined)?.auth?.uid;

  if (!uid) {
    throw new Error(
      "No uid in context. The tool cannot know whose data to read."
    );
  }

  return uid;
};

const requirePrefs = (context: unknown): ProgramDraftPrefs => {
  const prefs = (context as CoachContext | undefined)?.prefs;

  if (!prefs) {
    throw new Error("No prefs in context. Cannot build a program without them.");
  }

  return prefs;
};

export const getWorkoutLogsTool = ai.defineTool(
  {
    name: "getWorkoutLogs",
    description:
      "Get the user's logged workouts between two dates. Use this whenever " +
      "the user asks about what they trained, their weights, reps, volume, " +
      "or progress over time. Dates are YYYY-MM-DD and the range is inclusive.",
    inputSchema: z.object({
      startDate: IsoDateSchema.describe("First day to include, YYYY-MM-DD."),
      endDate: IsoDateSchema.describe("Last day to include, YYYY-MM-DD."),
    }),
    outputSchema: z.object({
      logs: z
        .array(
          z.object({
            date: z.string(),
            activity: z.string(),
            sets: z.array(z.string()),
            notes: z.string().optional(),
          })
        )
        .optional(),
      truncated: z.boolean().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ startDate, endDate }, { context }) => {
    const uid = requireUid(context);

    // Returned as data, not thrown: a bad range is the model's mistake to fix,
    // and it can only fix it if it gets told what was wrong.
    if (startDate > endDate) {
      return { error: "startDate must be on or before endDate." };
    }

    if (daysBetween(startDate, endDate) > MAX_RANGE_DAYS) {
      return {
        error: `Range too wide. Ask for at most ${MAX_RANGE_DAYS} days.`,
      };
    }

    const { logs, truncated } = await getExerciseLogsByDateRange(
      uid,
      startDate,
      endDate
    );

    return { logs: logs.map(formatLog), truncated };
  }
);

export const getLabelsTool = ai.defineTool(
  {
    name: "getLabels",
    description:
      "Get the user's workout day labels (for example Push, Pull, Legs), " +
      "with how many days each has been used. Use this to understand how " +
      "they split their training week.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      labels: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          timesUsed: z.number(),
        })
      ),
    }),
  },
  async (_input, { context }) => {
    const uid = requireUid(context);
    const labels = await getAllLabels(uid);
    return { labels: labels.map(formatLabel) };
  }
);

export const getProgramsTool = ai.defineTool(
  {
    name: "getPrograms",
    description:
      "Get the user's saved workout program templates: the planned " +
      "exercises and sets for each day. Use this to compare what they " +
      "planned against what they actually logged.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      programs: z.array(
        z.object({
          name: z.string(),
          days: z.array(
            z.object({
              day: z.number(),
              isRestDay: z.boolean(),
              label: z.string().optional(),
              exercises: z
                .array(
                  z.object({
                    activity: z.string(),
                    sets: z.array(z.string()),
                  })
                )
                .optional(),
            })
          ),
        })
      ),
    }),
  },
  async (_input, { context }) => {
    const uid = requireUid(context);
    const programs = await getPrograms(uid);
    return { programs: programs.map(formatProgram) };
  }
);

export const proposeProgramTool = ai.defineTool(
  {
    name: "proposeProgram",
    description:
      "Propose a workout program for the user to review. Only call this " +
      "once you know their goal and how many days a week they train. " +
      "Programs are sets and reps only — never weights. Reps are a plain " +
      "number the app converts to the user's preferred format. " +
      "labelEmoji is one emoji or one letter, never a word. Call getLabels " +
      "first and reuse an existing label's description exactly when one fits.",
    inputSchema: ProgramDraftArgsSchema,
    outputSchema: z.object({
      ok: z.boolean().optional(),
      summary: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async (args, { context }) => {
    const prefs = requirePrefs(context);

    // Note this does NOT save anything. The program goes back to the app for
    // the user to accept; saving is a separate, user-initiated action.
    const program = toProgram(args, prefs);

    if (!program) {
      return {
        error:
          "Those arguments could not be read as a program. Check that every day " +
          "has isRestDay, that training days have at least one exercise, that " +
          "labelEmoji and labelDescription are sent together, that labelEmoji is " +
          'one emoji or one letter, and that reps is a plain number like "8".',
      };
    }

    // Only a summary goes back to the model. The program itself is rebuilt by
    // the flow from these same arguments — sending the whole thing here would
    // spend tokens describing something the user can already see.
    return { ok: true, summary: describeProgram(program) };
  }
);

export const coachTools = [
  getWorkoutLogsTool,
  getLabelsTool,
  getProgramsTool,
  proposeProgramTool,
];
