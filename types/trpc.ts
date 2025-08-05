// src/types/trpc.ts (in your Expo app)

// Copy/replicate the Zod schemas from your server.
// These must match exactly for type safety to work!
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// These are utility types that make working with tRPC types easier
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'; // Needed for type inference

// Replicate Zod schema for FitnessLog from your server's src/trpc/routers/fitness.ts
const SetSchema = z.discriminatedUnion("setType", [
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
const ExerciseLogSchema = z.object({
    date: z.string().datetime(), // ISO 8601 date string
    activity: z.string().min(3).max(100),
    caloriesBurned: z.number().int().optional(),
    notes: z.string().max(500).optional(),
    sets: z.array(SetSchema), // Array of exercise sets
});

const DaySchema = z.object({
    date: z.string().datetime(), // ISO 8601 date string
    activities: z.array(ExerciseLogSchema), // Array of exercise logs for the day
    day: z.array(z.string().min(1).max(20)).optional(), // Optional day name (e.g., "Monday")
});
export type ExerciseLog = z.infer<typeof ExerciseLogSchema>; // Useful client-side type

// Define the shape of your AppRouter, mirroring your server's appRouter.
// Use a dummy tRPC instance to infer the type.
const t = initTRPC.create();
const dummyRouter = t.router({
    fitness: t.router({ // Match the 'fitness' namespace from your server
        addExerciseLog: t.procedure
            .input(ExerciseLogSchema) // Matches your server's input
            .mutation(() => { /* dummy implementation */ }), // Match server's method (mutation)
        getExerciseLogByDate: t.procedure
        .input(z.object({ date: z.string().datetime() }))
            .query(() => { /* dummy implementation */ }), // Match server's method (query)
    }),
    // Add other routers/procedures here as they exist on your server
});

// This is the crucial export for client-side type inference
export type AppRouter = typeof dummyRouter;
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
