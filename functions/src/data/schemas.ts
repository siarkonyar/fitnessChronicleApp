/**
 * Server-side mirrors of the Firestore document shapes.
 *
 * These duplicate types/types.ts rather than importing it, for two reasons that
 * are not going away:
 *
 *  1. types/types.ts is built on zod 4; Genkit requires its vendored zod 3, and
 *     the two instances are not interchangeable.
 *  2. its FirestoreTimestampSchema depends on @react-native-firebase/firestore,
 *     which does not exist on a server.
 *
 * Only the fields the coach actually reads are declared. zod strips the rest, so
 * `createdAt` is dropped without needing an Admin Timestamp type. Keep these in
 * step with types/types.ts by hand — there is no way to share them.
 */
import { z } from "genkit";

/** Mirrors SetSchema in types/types.ts:19 — a discriminated union on measure. */
export const SetSchema = z.discriminatedUnion("measure", [
  z.object({
    measure: z.literal("kg"),
    setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    measure: z.literal("lbs"),
    setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    measure: z.literal("time"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
  z.object({
    measure: z.literal("distance"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
  z.object({
    measure: z.literal("steps"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
]);

/** Mirrors ExerciseLogSchema (types/types.ts:56), minus fields the coach ignores. */
export const ExerciseLogSchema = z.object({
  date: z.string(),
  activity: z.string(),
  notes: z.string().optional(),
  sets: z.array(SetSchema),
});

/** Mirrors LabelSchema (types/types.ts:66). `dates` is only used for a count. */
export const LabelSchema = z.object({
  label: z.string(),
  description: z.string(),
  dates: z.array(z.string()).optional(),
});

export const ProgramExerciseSchema = z.object({
  activity: z.string(),
  notes: z.string().optional(),
  sets: z.array(SetSchema),
});

export const ProgramDaySchema = z.object({
  isRestDay: z.boolean(),
  label: LabelSchema.optional(),
  exercises: z.array(ProgramExerciseSchema).optional(),
});

/** Mirrors ProgramSchema (types/types.ts:92). */
export const ProgramSchema = z.object({
  name: z.string(),
  days: z.array(ProgramDaySchema),
});

export type ExerciseSet = z.infer<typeof SetSchema>;
export type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Program = z.infer<typeof ProgramSchema>;
