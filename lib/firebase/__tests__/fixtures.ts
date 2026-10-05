/**
 * Builders for valid domain objects, shared by the data-layer unit tests.
 *
 * Every builder returns a NEW object that already passes its Zod schema, so a
 * test only spells out the field it is actually about.
 */
import type {
  ExerciseLogSchema,
  LabelSchema,
  ProgramDaySchema,
  SetSchema,
} from "@/types/types";
import type { z } from "zod";

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
type Label = z.infer<typeof LabelSchema>;
type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ExerciseSet = z.infer<typeof SetSchema>;

export const kgSet = (overrides: Partial<ExerciseSet> = {}): ExerciseSet =>
  ({
    measure: "kg",
    setType: "normal",
    value: "60",
    reps: "8",
    ...overrides,
  }) as ExerciseSet;

export const makeLog = (overrides: Partial<ExerciseLog> = {}): ExerciseLog => ({
  date: "2026-06-10",
  activity: "bench press",
  sets: [kgSet()],
  ...overrides,
});

export const makeLabel = (overrides: Partial<Label> = {}): Label => ({
  label: "💪",
  description: "Push",
  dates: [],
  ...overrides,
});

export const makeTrainingDay = (
  overrides: Partial<ProgramDay> = {},
): ProgramDay => ({
  isRestDay: false,
  label: { label: "💪", description: "Push" },
  exercises: [{ activity: "bench press", sets: [kgSet()] }],
  ...overrides,
});

export const REST_DAY: ProgramDay = { isRestDay: true };
