/**
 * Compacts Firestore documents into small, token-cheap shapes for the AI coach.
 *
 * Firestore rows are verbose: every set is a full object, and every doc carries
 * `id` / `createdAt` the model has no use for. Sending those raw wastes tokens
 * and buries the signal. Everything here is a pure function — no Firestore, no
 * Gemini SDK — which is what makes it the easiest part of the feature to test.
 */
import {
  ExerciseLogWithIdSchema,
  LabelWithIdSchema,
  ProgramWithIdSchema,
  SetSchema,
} from "@/types/types";
import { z } from "zod";

// `Set` is the JS built-in, so the domain type takes a prefix to avoid shadowing
// it (exercise.ts uses `new Set<string>()` in this same codebase).
type ExerciseSet = z.infer<typeof SetSchema>;
type ExerciseLogWithId = z.infer<typeof ExerciseLogWithIdSchema>;
type LabelWithId = z.infer<typeof LabelWithIdSchema>;
type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

/**
 * Unit written after the raw value, per measure.
 * `time` is seconds and `distance` is kilometres — matching the "Km:" label in
 * components/exercise/AddSetCard.tsx.
 */
const MEASURE_SUFFIX: Record<ExerciseSet["measure"], string> = {
  kg: "kg",
  lbs: "lbs",
  time: "s",
  distance: "km",
  steps: " steps",
};

/** Placeholder for a set logged without a value or reps. */
const MISSING_VALUE = "?";

// ---------------------------------------------------------------------------
// Output shapes — the contract the model sees
// ---------------------------------------------------------------------------

export interface CompactLog {
  date: string;
  activity: string;
  sets: string[];
  notes?: string;
}

export interface CompactLabel {
  name: string;
  description: string;
  timesUsed: number;
}

export interface CompactProgramExercise {
  activity: string;
  sets: string[];
}

export interface CompactProgramDay {
  day: number;
  isRestDay: boolean;
  label?: string;
  exercises?: CompactProgramExercise[];
}

export interface CompactProgram {
  name: string;
  days: CompactProgramDay[];
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export const formatSet = (set: ExerciseSet) : string => {
  const value = `${set.value ?? MISSING_VALUE}${MEASURE_SUFFIX[set.measure]}`;

  const withReps =
    "reps" in set ? `${value} x ${set.reps ?? MISSING_VALUE}` : value;

  return set.setType === "normal" ? withReps : `${withReps} (${set.setType})`;
}

/** One logged exercise -> { date, activity, sets, notes? }. */
export const formatLog = (log: ExerciseLogWithId): CompactLog => ({
  date: log.date,
  activity: log.activity,
  sets: log.sets.map(formatSet),
  notes: log.notes,
});

/** One label -> { name, description, timesUsed }. */
export const formatLabel = (label: LabelWithId): CompactLabel => ({
  name: label.label,
  description: label.description,
  timesUsed: label.dates?.length ?? 0,
});

/** One program -> { name, days } with rest days and exercises flattened. */
export const formatProgram = (program: ProgramWithId): CompactProgram => ({
  name: program.name,
  days: program.days.map((day, index) => ({
    // 1-indexed: the model talks about "Day 1", never "Day 0".
    day: index + 1,
    isRestDay: day.isRestDay,
    label: day.label?.label,
    exercises: day.exercises?.map((exercise) => ({
      activity: exercise.activity,
      sets: exercise.sets.map(formatSet),
    })),
  })),
});
