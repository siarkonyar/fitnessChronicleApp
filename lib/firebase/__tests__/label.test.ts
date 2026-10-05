import {
  addLabel,
  asignLabelToDay,
  deleteAssignment,
  deleteLabel,
  editLabel,
  getAllLabels,
  getAllLabelsFromMonth,
  getLabelAsignmentByDate,
  getLabelById,
  getPrevExercisesFromLabel,
} from "../label";
import { makeLabel, makeLog } from "./fixtures";
import {
  TEST_UID,
  listPaths,
  readDoc,
  resetFirestore,
  seedDoc,
} from "./firestoreTestUtils";

jest.mock("@react-native-firebase/firestore", () =>
  require("./firestoreTestUtils"),
);

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: { uid: "test-user" } }),
}));

beforeEach(() => {
  resetFirestore();
});

describe("label", () => {
  test("assigning a label to a date adds that date to the labels dates array", async () => {
    // Arrange — a label that exists but has no dates yet
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: [],
    });

    // Act
    await asignLabelToDay({ date: "2026-06-01", labelId: "push" });

    // Assert — the date is now stored on the label
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([
      "2026-06-01",
    ]);
  });

  test("deleting an assignment removes that date from the label's dates array", async () => {
    // Arrange — the label already has the date, and an assignment doc exists
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: ["2026-06-01"],
    });
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], {
      date: "2026-06-01",
      labelId: "push",
    });

    // Act
    await deleteAssignment("2026-06-01");

    // Assert — date gone from the label, and the assignment doc is gone too
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([]);
    expect(
      readDoc(["users", TEST_UID, "dayAssignments", "a1"]),
    ).toBeUndefined();
  });

  test("changing a date's label removes the date from the previous label", async () => {
    // Arrange — date currently belongs to "push"; "pull" exists and is empty
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: ["2026-06-01"],
    });
    seedDoc(["users", TEST_UID, "labels", "pull"], {
      label: "Pull",
      description: "Pull day",
      dates: [],
    });
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], {
      date: "2026-06-01",
      labelId: "push",
    });

    // Act — reassign the same date to "pull"
    await asignLabelToDay({ date: "2026-06-01", labelId: "pull" });

    // Assert — removed from old label, added to new label
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([]);
    expect(readDoc(["users", TEST_UID, "labels", "pull"])?.dates).toEqual([
      "2026-06-01",
    ]);
  });
});

describe("getPrevExercisesFromLabel", () => {
  test("returns the session when the most recent assigned date has logs", async () => {
    // Arrange — label was trained on one past day, which has a logged exercise
    seedDoc(["users", TEST_UID, "fitnessLogs", "log1"], {
      date: "2020-05-20",
      activity: "Bench Press",
      sets: [],
      dates: ["2020-05-20"],
    });

    const label = {
      label: "Push",
      description: "Push day",
      dates: ["2020-05-20"],
    };

    // Act
    const result = await getPrevExercisesFromLabel(label);

    // Assert — we get that day's exercise back
    expect(result).not.toBeNull();
    expect(result?.[0].activity).toBe("Bench Press");
  });

  test("returns the most recent day that actually has logs, skipping empty assigned days", async () => {
    // Arrange — label assigned to TWO past days:
    //   2020-05-20 → has a real logged session
    //   2020-05-28 → assigned but NOTHING logged (e.g. tagged but not trained)
    seedDoc(["users", TEST_UID, "fitnessLogs", "log1"], {
      date: "2020-05-20",
      activity: "Bench Press",
      sets: [],
    });

    const label = {
      label: "Push",
      description: "Push day",
      dates: ["2020-05-20", "2020-05-28"], // 28th is the most recent, but empty
    };

    // Act
    const result = await getPrevExercisesFromLabel(label);

    // Assert — the "last session" should be the 20th (the real one), NOT null
    expect(result).not.toBeNull();
    expect(result?.[0].date).toBe("2020-05-20");
  });
});

describe("addLabel", () => {
  test("stores the label with a creation timestamp", async () => {
    await addLabel({ label: "🦵", description: "Legs", dates: [] });

    const [path] = listPaths(["users", TEST_UID, "labels"]);
    expect(readDoc(path.split("/"))).toMatchObject({
      label: "🦵",
      description: "Legs",
      dates: [],
    });
    expect(readDoc(path.split("/"))?.createdAt).toBeInstanceOf(Date);
  });

  test("allows two labels with the same description", async () => {
    // Uniqueness is only enforced when an AI program is accepted
    // (lib/programLabels.ts), not here.
    await addLabel({ label: "A", description: "Push" });
    await addLabel({ label: "B", description: "Push" });

    expect(listPaths(["users", TEST_UID, "labels"])).toHaveLength(2);
  });
});

describe("getLabelById / getAllLabels", () => {
  test("returns one label with its id", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel());

    expect(await getLabelById("push")).toMatchObject({ id: "push", description: "Push" });
  });

  // FIXME: `!doc.exists` is always false on RNFB v23 (exists is a method).
  test.failing("reports a missing label as not found", async () => {
    await expect(getLabelById("missing")).rejects.toThrow("Label not found.");
  });

  test("lists labels newest first", async () => {
    seedDoc(["users", TEST_UID, "labels", "old"], {
      ...makeLabel({ description: "Old" }),
      createdAt: new Date("2026-01-01"),
    });
    seedDoc(["users", TEST_UID, "labels", "new"], {
      ...makeLabel({ description: "New" }),
      createdAt: new Date("2026-06-01"),
    });

    const labels = await getAllLabels();

    expect(labels.map((label) => label.id)).toEqual(["new", "old"]);
  });

  test("omits labels that were stored without createdAt", async () => {
    // Firestore's orderBy drops documents missing the ordered field.
    seedDoc(["users", TEST_UID, "labels", "legacy"], makeLabel());

    expect(await getAllLabels()).toEqual([]);
  });

  test("fills in default dates for a label stored without any", async () => {
    seedDoc(["users", TEST_UID, "labels", "bare"], { label: "X", description: "Bare" });

    expect((await getLabelById("bare")).dates).toEqual([]);
  });
});

describe("getAllLabelsFromMonth", () => {
  const assign = (id: string, date: string, labelId = "push") =>
    seedDoc(["users", TEST_UID, "dayAssignments", id], { date, labelId });

  test("returns only assignments inside the month, boundaries included", async () => {
    assign("a", "2026-01-31");
    assign("b", "2026-02-01", "pull");
    assign("c", "2026-02-28", "legs");
    assign("d", "2026-03-01");

    const result = await getAllLabelsFromMonth("2026-02");

    expect(result).toEqual(
      expect.arrayContaining([
        { date: "2026-02-01", labelId: "pull" },
        { date: "2026-02-28", labelId: "legs" },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  test("includes 29 February in a leap year", async () => {
    assign("leap", "2028-02-29");

    expect(await getAllLabelsFromMonth("2028-02")).toEqual([
      { date: "2028-02-29", labelId: "push" },
    ]);
  });

  test("returns an empty list for a month without assignments", async () => {
    expect(await getAllLabelsFromMonth("2026-02")).toEqual([]);
  });

  test.each(["2026-2", "2026/02", "26-02", "2026-02-01", ""])(
    "rejects the malformed month %p",
    async (month) => {
      await expect(getAllLabelsFromMonth(month)).rejects.toThrow();
    },
  );
});

describe("editLabel", () => {
  test("updates emoji and description but keeps the assigned dates", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel({ dates: ["2026-06-01"] }));

    const updated = await editLabel("push", { label: "🔥", description: "Chest" });

    expect(updated).toMatchObject({
      id: "push",
      label: "🔥",
      description: "Chest",
      dates: ["2026-06-01"],
    });
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.updatedAt).toBeInstanceOf(Date);
  });

  test("does not create a label that does not exist", async () => {
    await expect(editLabel("missing", makeLabel())).rejects.toThrow();
    expect(listPaths(["users", TEST_UID, "labels"])).toEqual([]);
  });
});

describe("deleteLabel", () => {
  test("removes the label and every assignment pointing at it", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel({ dates: ["2026-06-01", "2026-06-03"] }));
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], { date: "2026-06-01", labelId: "push" });
    seedDoc(["users", TEST_UID, "dayAssignments", "a2"], { date: "2026-06-03", labelId: "push" });
    seedDoc(["users", TEST_UID, "dayAssignments", "a3"], { date: "2026-06-02", labelId: "pull" });

    const result = await deleteLabel("push");

    expect(result).toEqual({ id: "push", message: "Label deleted successfully!" });
    expect(listPaths(["users", TEST_UID])).toEqual([
      `users/${TEST_UID}/dayAssignments/a3`,
    ]);
  });

  test("leaves another label's assignment on a shared date alone", async () => {
    // The label's dates array is stale: 2026-06-01 was reassigned to pull.
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel({ dates: ["2026-06-01"] }));
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], { date: "2026-06-01", labelId: "pull" });

    await deleteLabel("push");

    expect(readDoc(["users", TEST_UID, "dayAssignments", "a1"])).toEqual({
      date: "2026-06-01",
      labelId: "pull",
    });
  });

  test("deletes a label that has never been assigned", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel());

    await deleteLabel("push");

    expect(readDoc(["users", TEST_UID, "labels", "push"])).toBeUndefined();
  });

  // FIXME: resolves "deleted successfully" for a label that never existed.
  test.failing("reports a missing label as not found", async () => {
    await expect(deleteLabel("missing")).rejects.toThrow("Label not found.");
  });
});

describe("asignLabelToDay", () => {
  test("creates an assignment and reports it as new", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel());

    const result = await asignLabelToDay({ date: "2026-06-01", labelId: "push" });

    expect(result).toMatchObject({
      date: "2026-06-01",
      labelId: "push",
      message: "Label assigned to day successfully!",
    });
    expect(readDoc(["users", TEST_UID, "dayAssignments", result.id])).toMatchObject({
      date: "2026-06-01",
      labelId: "push",
    });
  });

  test("assigning the same label twice keeps one assignment and one date", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel());

    await asignLabelToDay({ date: "2026-06-01", labelId: "push" });
    const second = await asignLabelToDay({ date: "2026-06-01", labelId: "push" });

    expect(second.message).toBe("Label assignment updated successfully!");
    expect(listPaths(["users", TEST_UID, "dayAssignments"])).toHaveLength(1);
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual(["2026-06-01"]);
  });

  test("one label can own many dates", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel());

    await asignLabelToDay({ date: "2026-06-01", labelId: "push" });
    await asignLabelToDay({ date: "2026-06-08", labelId: "push" });

    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([
      "2026-06-01",
      "2026-06-08",
    ]);
  });

  // FIXME: with the dead exists() check, assigning a deleted label writes
  // a dangling dayAssignments document before the label update fails.
  test.failing("refuses a missing label without leaving a dangling assignment", async () => {
    await expect(
      asignLabelToDay({ date: "2026-06-01", labelId: "missing" }),
    ).rejects.toThrow("Label not found.");
    expect(listPaths(["users", TEST_UID, "dayAssignments"])).toEqual([]);
  });
});

describe("getLabelAsignmentByDate", () => {
  test("returns the full label assigned to the date", async () => {
    seedDoc(["users", TEST_UID, "labels", "push"], makeLabel({ dates: ["2026-06-01"] }));
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], { date: "2026-06-01", labelId: "push" });

    expect(await getLabelAsignmentByDate("2026-06-01")).toMatchObject({
      id: "push",
      description: "Push",
    });
  });

  test("returns null for an unassigned date", async () => {
    expect(await getLabelAsignmentByDate("2026-06-01")).toBeNull();
  });

  // FIXME: the self-healing branch for an assignment whose label was
  // deleted is unreachable (exists is a method), so a ZodError escapes and the
  // orphan stays.
  test.failing("cleans up an assignment whose label was deleted", async () => {
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], { date: "2026-06-01", labelId: "gone" });

    expect(await getLabelAsignmentByDate("2026-06-01")).toBeNull();
    expect(readDoc(["users", TEST_UID, "dayAssignments", "a1"])).toBeUndefined();
  });
});

describe("deleteAssignment (edge cases)", () => {
  test("throws when the date has no assignment", async () => {
    await expect(deleteAssignment("2026-06-01")).rejects.toThrow(
      "No label assignment found for this date.",
    );
  });

  test("removes an assignment that has no labelId without touching labels", async () => {
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], { date: "2026-06-01" });

    const result = await deleteAssignment("2026-06-01");

    expect(result).toEqual({
      id: "a1",
      date: "2026-06-01",
      message: "Label assignment deleted successfully!",
    });
    expect(listPaths(["users", TEST_UID])).toEqual([]);
  });
});

describe("getPrevExercisesFromLabel (edge cases)", () => {
  test("returns null for a label that was never used", async () => {
    expect(await getPrevExercisesFromLabel(makeLabel({ dates: [] }))).toBeNull();
  });

  test("returns null for a label without a dates field", async () => {
    expect(await getPrevExercisesFromLabel({ label: "X", description: "Y" })).toBeNull();
  });

  test("ignores today's session and future plans", async () => {
    jest.useFakeTimers({ now: new Date("2026-06-10T12:00:00Z") });
    seedDoc(["users", TEST_UID, "fitnessLogs", "today"], makeLog({ date: "2026-06-10" }));
    seedDoc(["users", TEST_UID, "fitnessLogs", "past"], makeLog({ date: "2026-06-03", activity: "squat" }));

    const result = await getPrevExercisesFromLabel(
      makeLabel({ dates: ["2026-06-03", "2026-06-10", "2026-06-17"] }),
    );

    expect(result?.map((log) => log.activity)).toEqual(["squat"]);
    jest.useRealTimers();
  });

  test("returns nothing when no past assigned day was ever trained", async () => {
    // Note: the loop falls through and resolves undefined, not null.
    const result = await getPrevExercisesFromLabel(
      makeLabel({ dates: ["2020-01-01", "2020-01-08"] }),
    );

    expect(result ?? null).toBeNull();
  });
});
