module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Only treat *.test.ts / *.spec.ts as test suites. Without this, Jest's
  // default also runs every file under __tests__/ — including helpers like
  // firestoreTestUtils.ts, which have no tests and would fail.
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  // Ignore the git worktrees under .claude/ — each has its own package.json
  // named "fitnesschronicle", which otherwise collides in Jest's haste map.
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  // The Cloud Functions codebase is a separate project with its own runner.
  // Its suites import from "vitest", so Jest collecting them here fails every
  // one of them on the import alone, burying the app's real results. Run them
  // with `npm test` inside functions/ instead.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/functions/"],
};
