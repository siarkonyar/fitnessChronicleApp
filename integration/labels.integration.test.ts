/**
 * lib/firebase/label.ts against the real Firestore emulator: arrayUnion /
 * arrayRemove applied by the server, assignment cascades, month queries, and
 * the orphan cases the exists() bug leaves behind.
 */
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
} from "@/lib/firebase/label";
import { addExerciseLog } from "@/lib/firebase/exercise";
import { makeLabel, makeLog } from "@/lib/firebase/__tests__/fixtures";
import {
  adminDb,
  caught,
  pathsUnderUser,
  readAsAdmin,
  signUpNewUser,
  type TestUser,
} from "./support/emulator";

let user: TestUser;

beforeEach(async () => {
  user = await signUpNewUser();
});

/** Creates a label through the app and returns its id. */
const createLabel = async (description: string): Promise<string> => {
  await addLabel(makeLabel({ description }));
  const labels = await getAllLabels();
  const created = labels.find((label) => label.description === description);
  if (!created) throw new Error(`label ${description} was not created`);
  return created.id;
};

const assignments = async () =>
  (await adminDb.collection(`users/${user.uid}/dayAssignments`).get()).docs.map((doc) => doc.data());

const datesOf = async (labelId: string) =>
  (await readAsAdmin(`users/${user.uid}/labels/${labelId}`))?.dates;

describe("creating and editing labels", () => {
  test("lists labels newest first by server timestamp", async () => {
    await createLabel("Push");
    await createLabel("Pull");
    await createLabel("Legs");

    expect((await getAllLabels()).map((label) => label.description)).toEqual(["Legs", "Pull", "Push"]);
  });

  test("an edit renames the label and keeps its assigned dates", async () => {
    const push = await createLabel("Push");
    await asignLabelToDay({ date: "2026-06-01", labelId: push });

    const edited = await editLabel(push, { label: "🔥", description: "Chest" });

    expect(edited).toMatchObject({ id: push, label: "🔥", description: "Chest", dates: ["2026-06-01"] });
  });

  test("editing a label that does not exist fails with not-found", async () => {
    expect((await caught(() => editLabel("missing", makeLabel()))).code).toBe("firestore/not-found");
  });
});

describe("assigning labels to days", () => {
  test("assigning records the day on both the assignment and the label", async () => {
    const push = await createLabel("Push");

    await asignLabelToDay({ date: "2026-06-01", labelId: push });

    expect(await assignments()).toEqual([expect.objectContaining({ date: "2026-06-01", labelId: push })]);
    expect(await datesOf(push)).toEqual(["2026-06-01"]);
    expect(await getLabelAsignmentByDate("2026-06-01")).toMatchObject({ id: push });
  });

  test("reassigning a day moves the date from the old label to the new one", async () => {
    const push = await createLabel("Push");
    const pull = await createLabel("Pull");
    await asignLabelToDay({ date: "2026-06-01", labelId: push });

    const result = await asignLabelToDay({ date: "2026-06-01", labelId: pull });

    expect(result.message).toBe("Label assignment updated successfully!");
    expect(await assignments()).toHaveLength(1);
    expect(await datesOf(push)).toEqual([]);
    expect(await datesOf(pull)).toEqual(["2026-06-01"]);
  });

  test("assigning the same label twice never duplicates the date", async () => {
    const push = await createLabel("Push");

    await asignLabelToDay({ date: "2026-06-01", labelId: push });
    await asignLabelToDay({ date: "2026-06-01", labelId: push });

    expect(await datesOf(push)).toEqual(["2026-06-01"]);
  });

  test("concurrent assignments of different days to one label keep every date", async () => {
    // arrayUnion is applied by the server, so parallel writers cannot lose
    // each other's dates the way a read-modify-write would.
    const push = await createLabel("Push");

    await Promise.all(
      ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"].map((date) =>
        asignLabelToDay({ date, labelId: push }),
      ),
    );

    expect([...(await datesOf(push))].sort()).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
    ]);
  });

  test("lists one month of assignments, boundaries included", async () => {
    const push = await createLabel("Push");
    for (const date of ["2026-01-31", "2026-02-01", "2026-02-28", "2026-03-01"]) {
      await asignLabelToDay({ date, labelId: push });
    }

    const february = await getAllLabelsFromMonth("2026-02");

    expect(february.map((entry) => entry.date).sort()).toEqual(["2026-02-01", "2026-02-28"]);
  });

  test("unassigning a day removes it from the label too", async () => {
    const push = await createLabel("Push");
    await asignLabelToDay({ date: "2026-06-01", labelId: push });

    await deleteAssignment("2026-06-01");

    expect(await assignments()).toEqual([]);
    expect(await datesOf(push)).toEqual([]);
    expect(await getLabelAsignmentByDate("2026-06-01")).toBeNull();
  });

  // FIXME: (reproduced on the real backend) the label existence check is
  // dead, so the assignment is written, then the label update fails with
  // not-found and the dangling assignment stays behind.
  test.failing("refuses a deleted label without leaving a dangling assignment", async () => {
    await caught(() => asignLabelToDay({ date: "2026-06-01", labelId: "deleted" }));

    expect(await assignments()).toEqual([]);
  });

  test("documents the dangling assignment the bug above leaves", async () => {
    const error = await caught(() => asignLabelToDay({ date: "2026-06-01", labelId: "deleted" }));

    expect(error.code).toBe("firestore/not-found");
    expect(await assignments()).toEqual([expect.objectContaining({ labelId: "deleted" })]);
  });
});

describe("deleting labels", () => {
  test("removes the label and every assignment pointing at it", async () => {
    const push = await createLabel("Push");
    const pull = await createLabel("Pull");
    await asignLabelToDay({ date: "2026-06-01", labelId: push });
    await asignLabelToDay({ date: "2026-06-03", labelId: push });
    await asignLabelToDay({ date: "2026-06-02", labelId: pull });

    await deleteLabel(push);

    expect(await assignments()).toEqual([expect.objectContaining({ labelId: pull })]);
    const remaining = (await pathsUnderUser(user.uid)).filter((path) => path.includes("/labels/"));
    expect(remaining).toEqual([`users/${user.uid}/labels/${pull}`]);
  });

  // FIXME: the auto-cleanup of an orphaned assignment is unreachable, so
  // a ZodError escapes when the calendar asks about that day.
  test.failing("cleans up an assignment whose label was deleted behind its back", async () => {
    const push = await createLabel("Push");
    await asignLabelToDay({ date: "2026-06-01", labelId: push });
    await adminDb.doc(`users/${user.uid}/labels/${push}`).delete();

    expect(await getLabelAsignmentByDate("2026-06-01")).toBeNull();
    expect(await assignments()).toEqual([]);
  });

  // FIXME: a missing label reports success.
  test.failing("deleting a missing label fails", async () => {
    await expect(deleteLabel("missing")).rejects.toThrow("Label not found.");
  });

  // FIXME: a missing label throws a ZodError, not "Label not found."
  test.failing("reading a missing label says it was not found", async () => {
    await expect(getLabelById("missing")).rejects.toThrow("Label not found.");
  });
});

describe("the previous session for a label", () => {
  test("finds the latest past day that was actually trained", async () => {
    const push = await createLabel("Push");
    await asignLabelToDay({ date: "2020-05-20", labelId: push });
    await asignLabelToDay({ date: "2020-05-27", labelId: push }); // tagged, never trained
    await addExerciseLog(makeLog({ date: "2020-05-20", activity: "bench press" }));

    const label = await getLabelById(push);
    const previous = await getPrevExercisesFromLabel(label);

    expect(previous?.map((log) => log.date)).toEqual(["2020-05-20"]);
  });
});
