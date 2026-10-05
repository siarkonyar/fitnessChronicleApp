import {
  addProgram,
  deleteProgram,
  getProgram,
  getPrograms,
  updateProgram,
} from "../program";
import { REST_DAY, makeTrainingDay } from "./fixtures";
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

let mockCurrentUser: { uid: string } | null = { uid: "test-user" };
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: mockCurrentUser }),
}));

const programPath = (id: string) => ["users", TEST_UID, "programs", id];

beforeEach(() => {
  resetFirestore();
  mockCurrentUser = { uid: TEST_UID };
});

describe("addProgram", () => {
  test("stores name, days and a creation time, and returns the new id", async () => {
    const days = [makeTrainingDay(), REST_DAY];

    const id = await addProgram("PPL", days);

    const stored = readDoc(programPath(id));
    expect(stored).toMatchObject({ name: "PPL", days });
    expect(stored?.createdAt).toBeInstanceOf(Date);
  });

  test("keeps the order of the days", async () => {
    const days = [
      makeTrainingDay({ label: { label: "A", description: "Push" } }),
      REST_DAY,
      makeTrainingDay({ label: { label: "B", description: "Pull" } }),
    ];

    const id = await addProgram("Order", days);

    expect((await getProgram(id)).days.map((day) => day.label?.description)).toEqual([
      "Push",
      undefined,
      "Pull",
    ]);
  });

  test("accepts a program made only of rest days", async () => {
    const id = await addProgram("Deload", [REST_DAY, REST_DAY]);

    expect((await getProgram(id)).days).toHaveLength(2);
  });

  test("accepts a program with no days at all", async () => {
    const id = await addProgram("Empty", []);

    expect((await getProgram(id)).days).toEqual([]);
  });

  test("rejects a day that carries an undefined field, as the native SDK does", async () => {
    // A rest day built as { isRestDay: true, label: undefined } would crash
    // the write on device; ProgramForm must omit the key instead.
    await expect(
      addProgram("Bad", [{ isRestDay: true, label: undefined }]),
    ).rejects.toThrow("Unsupported field value: undefined");
  });

  test("requires a signed-in user", async () => {
    mockCurrentUser = null;

    await expect(addProgram("PPL", [])).rejects.toThrow("User not authenticated");
  });
});

describe("getPrograms", () => {
  test("lists programs newest first", async () => {
    seedDoc(programPath("old"), { name: "Old", days: [], createdAt: new Date("2026-01-01") });
    seedDoc(programPath("new"), { name: "New", days: [], createdAt: new Date("2026-06-01") });

    expect((await getPrograms()).map((program) => program.id)).toEqual(["new", "old"]);
  });

  test("returns an empty list for a new user", async () => {
    expect(await getPrograms()).toEqual([]);
  });

  test("refuses to read a program with an empty name", async () => {
    seedDoc(programPath("bad"), { name: "", days: [], createdAt: new Date() });

    await expect(getPrograms()).rejects.toThrow();
  });

  test("does not see another user's programs", async () => {
    seedDoc(["users", "other", "programs", "p"], { name: "Theirs", days: [], createdAt: new Date() });

    expect(await getPrograms()).toEqual([]);
  });
});

describe("getProgram", () => {
  test("returns the program with its id", async () => {
    seedDoc(programPath("p1"), { name: "PPL", days: [REST_DAY] });

    expect(await getProgram("p1")).toEqual({ id: "p1", name: "PPL", days: [REST_DAY] });
  });

  // FIXME: `!doc.exists` is always false on RNFB v23 (exists is a method),
  // so a ZodError escapes instead of the not-found message.
  test.failing("reports a missing program as not found", async () => {
    await expect(getProgram("missing")).rejects.toThrow("Program not found.");
  });
});

describe("updateProgram", () => {
  test("renames a program without touching its days", async () => {
    seedDoc(programPath("p1"), { name: "Old", days: [REST_DAY] });

    await updateProgram("p1", { name: "New" });

    expect(readDoc(programPath("p1"))).toEqual({ name: "New", days: [REST_DAY] });
  });

  test("replaces the whole days array", async () => {
    seedDoc(programPath("p1"), { name: "P", days: [REST_DAY, REST_DAY] });

    await updateProgram("p1", { days: [makeTrainingDay()] });

    expect(readDoc(programPath("p1"))?.days).toEqual([makeTrainingDay()]);
  });

  test("fails rather than creating a program that does not exist", async () => {
    await expect(updateProgram("missing", { name: "Ghost" })).rejects.toThrow();
    expect(listPaths(["users", TEST_UID, "programs"])).toEqual([]);
  });
});

describe("deleteProgram", () => {
  test("removes only the requested program", async () => {
    seedDoc(programPath("keep"), { name: "Keep", days: [] });
    seedDoc(programPath("drop"), { name: "Drop", days: [] });

    await deleteProgram("drop");

    expect(listPaths(["users", TEST_UID, "programs"])).toEqual([
      `users/${TEST_UID}/programs/keep`,
    ]);
  });

  test("leaves the user's active program pointer for the caller to clear", async () => {
    // useActiveProgram treats an id with no matching program as "no program".
    seedDoc(["users", TEST_UID], { measure: "kg", activeProgramId: "drop" });
    seedDoc(programPath("drop"), { name: "Drop", days: [] });

    await deleteProgram("drop");

    expect(readDoc(["users", TEST_UID])?.activeProgramId).toBe("drop");
  });

  // FIXME: resolves silently for a program that never existed.
  test.failing("reports a missing program as not found", async () => {
    await expect(deleteProgram("missing")).rejects.toThrow("Program not found.");
  });
});
