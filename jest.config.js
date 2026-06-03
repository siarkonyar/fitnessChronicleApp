module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Ignore the git worktrees under .claude/ — each has its own package.json
  // named "fitnesschronicle", which otherwise collides in Jest's haste map.
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
};
