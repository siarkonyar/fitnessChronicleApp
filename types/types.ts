import { z } from "zod";

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

/* export const SetSchema = z.object({
  setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
  measure: z.enum(["kg", "lbs", "time", "distance", "step"]),
  value: z.string().optional(),
  reps: z.string().optional(),
}); */

// Zod schema for a fitness log entry
export const ExerciseLogSchema = z.object({
    date: z.string(), // ISO 8601 date string
    activity: z.string().min(3).max(100),
    caloriesBurned: z.number().int().optional(),
    notes: z.string().max(500).optional(),
    sets: z.array(SetSchema), // Array of exercise sets
    createdAt: z.date().optional(),
});

export const LabelSchema = z.object({
    label: z.string().min(1).max(10), // Limit emoji length
    description: z.string().min(1).max(100), // Add length constraints
    dates: z.array(z.string().date()).default([]).optional(), // Make dates optional with default empty array
    muscleGroups: z.array(z.string()).default([]).optional(),
    createdAt: z.date().optional(),
});

export const DaySchema = z.object({
    date: z.string().date(), // ISO 8601 date string
    labelId: z.string().min(1), // Reference to emoji ID instead of full object
    createdAt: z.date().optional(),
});

export const ExerciseNameListSchema = z.object({
    name: z.string(),
    createdAt: z.date().optional(),
})

// Zod schema for emoji assignments with an ID (when reading from DB)
export const LabelWithIdSchema = LabelSchema.extend({
    id: z.string(),
});

// Zod schema for day assignments with an ID (when reading from DB)
export const DayWithIdSchema = DaySchema.extend({
    id: z.string(),
});

// Zod schema for a fitness log entry with an ID (when reading from DB)
export const ExerciseLogWithIdSchema = ExerciseLogSchema.extend({
    id: z.string(),
});

export const ExerciseNameListWithIdSchema = ExerciseNameListSchema.extend({
    id: z.string(),
});