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
    default:
      return { error: `Unknown tool: ${name}` };
  }
};
