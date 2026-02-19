export const queryKeys = {
  // Exercise Logs
  exerciseLogs: {
    all: ["exerciseLogs"] as const,
    byDate: (date: string) => [...queryKeys.exerciseLogs.all, date] as const,
    byMonth: (month: string) =>
      [...queryKeys.exerciseLogs.all, month] as const,
    byId: (id: string) => [...queryKeys.exerciseLogs.all, id] as const,
  },

  // Latest Exercises
  latestExercises: {
    all: ["latestExercises"] as const,
    byName: (name: string) => [...queryKeys.latestExercises.all, name] as const,
  },

  // Labels
  labels: {
    all: ["labels"] as const,
    byId: (id: string) => [...queryKeys.labels.all, id] as const,
  },

  // Label Assignments
  labelAssignments: {
    all: ["labelAssignments"] as const,
    byMonth: (month: string) =>
      [...queryKeys.labelAssignments.all, month] as const,
    byDate: (date: string) =>
      [...queryKeys.labelAssignments.all, date] as const,
  },

  // Exercise Names
  exerciseNames: {
    all: ["exerciseNames"] as const,
  },
} as const;
