/**
 * The tools the AI coach can call to read the user's own training data.
 *
 * Two exports:
 *  - `coachTools`   the declarations handed to Gemini, so it knows what exists
 *  - `runCoachTool` the dispatcher that actually executes a call it asked for
 *
 * Everything the model sends is untrusted input crossing a boundary, so args
 * are Zod-validated before they reach Firestore.
 */
import { getExerciseLogsByDateRange } from "@/lib/firebase/exercise";
import { getAllLabels } from "@/lib/firebase/label";
import { getPrograms } from "@/lib/firebase/program";
import {
  Schema,
  type FunctionDeclarationsTool,
  type ObjectSchemaInterface,
} from "@react-native-firebase/ai";
import { z } from "zod";
import { daysBetween } from "../dateUtils";
import { formatLabel, formatLog, formatProgram } from "./formatWorkoutData";
import { describeProgram, toProgram } from "./programDraft";
import { getDefaultMeasurement, getDefaultRepType } from "../offlineStorage";

/** Hard cap on logs returned in one call, so a wide range can't blow the context window. */
const MAX_LOGS_RETURNED = 200;

/** Widest range we will query at once. */
const MAX_RANGE_DAYS = 366;

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const WorkoutLogsArgsSchema = z.object({
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
});

// ---------------------------------------------------------------------------
// Declarations — what the model is told it can call
// ---------------------------------------------------------------------------

const SetParamsSchema = Schema.object({
  properties: {
    setType: Schema.enumString({
      enum: ["warmup", "normal", "drop", "failure"],
      description: 'Almost always "normal".',
    }),
    reps: Schema.string({
      description:
        'A plain number like "8". Never a range like "6-8" — the app converts it.',
    }),
  },
});

const ExerciseParamsSchema = Schema.object({
  properties: {
    activity: Schema.string({
      description: 'The exercise name, for example "Barbell Bench Press".',
    }),
    notes: Schema.string({
      description:
        'Optional one-line cue, for example "slow eccentric". Never a weight.',
    }),
    sets: Schema.array({
      items: SetParamsSchema,
      minItems: 1,
      description: "One entry per set — three or four is typical.",
    }),
  },
  optionalProperties: ["notes"],
});

const DayParamsSchema = Schema.object({
  properties: {
    isRestDay: Schema.boolean({
      description: "True for a rest day, which has no label and no exercises.",
    }),
    labelEmoji: Schema.string({
      description:
        'One emoji or one letter, for example "🏋️". Never a word — the readable name goes in labelDescription.',
    }),
    labelDescription: Schema.string({
      description:
        'The day name, for example "Push". Call getLabels first and reuse an existing label\'s description exactly when one fits.',
    }),
    exercises: Schema.array({
      items: ExerciseParamsSchema,
      description: "The day's exercises. Omit entirely on a rest day.",
    }),
  },
  optionalProperties: ["labelEmoji", "labelDescription", "exercises"],
});

export const coachTools: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: "getWorkoutLogs",
        description:
          "Get the user's logged workouts between two dates. Use this whenever " +
          "the user asks about what they trained, their weights, reps, volume, " +
          "or progress over time. Dates are YYYY-MM-DD and the range is inclusive.",
        // `Schema.object()` sets type to SchemaType.OBJECT at runtime, but
        // inherits the widened `type: SchemaType` declaration from its base
        // class, so it never structurally satisfies ObjectSchemaInterface.
        // Narrowing cast — safe, and unavoidable with this SDK version.
        parameters: Schema.object({
          properties: {
            startDate: Schema.string({
              description: "First day to include, YYYY-MM-DD.",
            }),
            endDate: Schema.string({
              description: "Last day to include, YYYY-MM-DD.",
            }),
          },
        }) as ObjectSchemaInterface,
      },
      {
        name: "getLabels",
        description:
          "Get the user's workout day labels (for example Push, Pull, Legs), " +
          "with how many days each has been used. Use this to understand how " +
          "they split their training week.",
      },
      {
        name: "getPrograms",
        description:
          "Get the user's saved workout program templates: the planned " +
          "exercises and sets for each day. Use this to compare what they " +
          "planned against what they actually logged.",
      },
      {
        name: "proposeProgram",
        description:
          "Propose a workout program for the user to review. Only call this " +
          "once you know their goal and how many days a week they train. " +
          "Programs are sets and reps only — never weights. Reps are a plain " +
          "number the app converts to the user's preferred format. " +
          "labelEmoji is one emoji or one letter, never a word. Call getLabels " +
          "first and reuse an existing label's description exactly when one fits.",
        parameters: Schema.object({
          properties: {
            name: Schema.string({
              description:
                'A short program name, for example "Upper/Lower Split".',
            }),
            days: Schema.array({
              items: DayParamsSchema,
              minItems: 1,
              description:
                "One entry per day of the week's cycle, in order, including rest days.",
            }),
          },
        }) as ObjectSchemaInterface,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

const runGetWorkoutLogs = async (args: unknown): Promise<object> => {
  const parsed = WorkoutLogsArgsSchema.safeParse(args);

  if (!parsed.success) {
    return {
      error: "startDate and endDate are required, in YYYY-MM-DD format.",
    };
  }

  const { startDate, endDate } = parsed.data;

  if (startDate > endDate) {
    return { error: "startDate must be on or before endDate." };
  }

  if (daysBetween(startDate, endDate) > MAX_RANGE_DAYS) {
    return { error: `Range too wide. Ask for at most ${MAX_RANGE_DAYS} days.` };
  }

  const { logs } = await getExerciseLogsByDateRange(startDate, endDate);

  // Results come back date-ascending, so the tail is the most recent.
  const capped = logs.slice(-MAX_LOGS_RETURNED);

  return {
    logs: capped.map(formatLog),
    truncated: logs.length > capped.length,
  };
};

const runGetLabels = async (): Promise<object> => {
  const labels = await getAllLabels();
  return { labels: labels.map(formatLabel) };
};

const runGetPrograms = async (): Promise<object> => {
  const programs = await getPrograms();
  return { programs: programs.map(formatProgram) };
};

const runProposeProgram = async (args: unknown): Promise<object> => {
  const [isRepsFixed, measure] = await Promise.all([
    getDefaultRepType(),
    getDefaultMeasurement(),
  ]);

  const program = toProgram(args, {
    repType: isRepsFixed ? "fixed" : "range",
    measure,
  });

  if (!program) {
    return {
      error:
        "Those arguments could not be read as a program. Check that every day " +
        "has isRestDay, that training days have at least one exercise, that " +
        "labelEmoji and labelDescription are sent together, that labelEmoji is " +
        'one emoji or one letter, and that reps is a plain number like "8".',
    };
  }

  return { ok: true, summary: describeProgram(program) };
};

/**
 * Runs a tool the model asked for. Always resolves to an object, because that
 * is what a Gemini functionResponse requires.
 */
export const runCoachTool = async (
  name: string,
  args: unknown,
): Promise<object> => {
  switch (name) {
    case "getWorkoutLogs":
      return runGetWorkoutLogs(args);
    case "getLabels":
      return runGetLabels();
    case "getPrograms":
      return runGetPrograms();
    case "proposeProgram":
      return runProposeProgram(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
};
