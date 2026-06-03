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
};
