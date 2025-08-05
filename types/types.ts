import { z } from "zod";

// Replicate Zod schema for FitnessLog from your server's src/trpc/routers/fitness.ts
export const SetSchema = z.discriminatedUnion("setType", [
  z.object({
    setType: z.literal("kg"),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    setType: z.literal("lbs"),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    setType: z.literal("time"),
    value: z.string().optional(), // time in seconds, for example
    reps: z.string().optional(),
  }),
  z.object({
    setType: z.literal("distance"),
    value: z.string().optional(), // meters, km, etc.
    reps: z.string().optional(),
  }),
  z.object({
    setType: z.literal("steps"),
    value: z.string().optional(), // whole number of steps
    reps: z.string().optional(),
  }),
]);

// Zod schema for a fitness log entry
export const ExerciseLogSchema = z.object({
    date: z.string().date(), // ISO 8601 date string
    activity: z.string().min(3).max(100),
    caloriesBurned: z.number().int().optional(),
    notes: z.string().max(500).optional(),
    sets: z.array(SetSchema), // Array of exercise sets
});

export const DaySchema = z.object({
    date: z.string().date(), // ISO 8601 date string
    activities: z.array(ExerciseLogSchema), // Array of exercise logs for the day
    day: z.array(z.string().min(1).max(20)).optional(), // Optional day name (e.g., "Monday")
});