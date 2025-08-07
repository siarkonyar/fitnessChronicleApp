// src/types/trpc.ts (in your Expo app)

// Copy/replicate the Zod schemas from your server.
// These must match exactly for type safety to work!
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// These are utility types that make working with tRPC types easier
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'; // Needed for type inference
import { ExerciseLogSchema } from './types';

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
        .input(z.object({ date: z.string().date() }))
            .query(() => { /* dummy implementation */ }), // Match server's method (query)
        getExerciseLogsByMonth : t.procedure
        .input(z.object({ month: z.string() }))
        .query(() => { /* dummy implementation */ }),
        editExerciseLog: t.procedure
            .input(z.object({ logId: z.string().min(1), data: ExerciseLogSchema }))
            .mutation(() => { /* dummy implementation */ }), // Match server's method (mutation)
    }),
    // Add other routers/procedures here as they exist on your server
});

// This is the crucial export for client-side type inference
export type AppRouter = typeof dummyRouter;
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
