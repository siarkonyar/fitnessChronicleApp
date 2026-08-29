import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Run test FILES one at a time, never in parallel.
     *
     * The integration suites all talk to a single Firestore emulator, and its
     * data is global to that process. Two files running at once would let one
     * suite's seeding and resets land in the middle of another's assertions,
     * producing failures that only appear sometimes — the worst kind.
     */
    fileParallelism: false,

    /**
     * 5s (Vitest's default) is generous for pure functions and far too tight
     * for a real callable request. The first call in a run pays for the
     * functions emulator loading and initialising the code, which alone can
     * take several seconds on a cold start.
     */
    testTimeout: 20_000,
  },
});
