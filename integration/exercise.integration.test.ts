/**
 * lib/firebase/exercise.ts against the real Firestore emulator, as a real
 * signed-in user: server timestamps, real queries and ordering, real batches,
 * real firestore.rules.
 */
import { getISOWeek, getPreviousWeek, getTodayString } from "@/lib/dateUtils";
import {
  addExerciseLog,
  deleteExerciseLog,
  deleteExerciseName,
  editExerciseLog,
  getAllExerciseNames,
  getExerciseLogById,
  getExerciseLogByDate,
  getExerciseLogsByDateRange,
  getExerciseLogsByMonth,
  getLatestExercisesByName,
  syncOfflineExercises,
} from "@/lib/firebase/exercise";
import { Timestamp } from "firebase-admin/firestore";
import { makeLog } from "@/lib/firebase/__tests__/fixtures";
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
  // A fresh account per test keeps every assertion about "all my data" exact.
  user = await signUpNewUser();
});

const logsOf = async () =>
  (await pathsUnderUser(user.uid)).filter((path) => path.includes("/fitnessLogs/"));

describe("logging a workout", () => {
  test("stores the log with a real server timestamp", async () => {
    const before = Date.now();

    const id = await addExerciseLog(makeLog({ date: "2026-06-10" }));

    const stored = await readAsAdmin(`users/${user.uid}/fitnessLogs/${id}`);
    expect(stored?.createdAt).toBeInstanceOf(Timestamp);
    expect(stored?.createdAt.toMillis()).toBeGreaterThanOrEqual(before - 5_000);
  });

  test("reads the server Timestamp back as a JS Date through the Zod schema", async () => {
    await addExerciseLog(makeLog({ date: "2026-06-10" }));

    const [log] = await getExerciseLogByDate("2026-06-10");

    expect(log.createdAt).toBeInstanceOf(Date);
  });

  test("starts a streak in the user's document for the current week", async () => {
    await addExerciseLog(makeLog());

    expect(await readAsAdmin(`users/${user.uid}`)).toEqual({
      streakWeeks: 1,
      lastLoggedWeek: getISOWeek(new Date()),
    });
  });

  test("extends a streak kept up last week", async () => {
    const lastWeek = getPreviousWeek(getISOWeek(new Date()));
    await adminDb.doc(`users/${user.uid}`).set({ streakWeeks: 7, lastLoggedWeek: lastWeek });

    await addExerciseLog(makeLog());

    expect((await readAsAdmin(`users/${user.uid}`))?.streakWeeks).toBe(8);
  });

  test("remembers each exercise name once across many logs", async () => {
    await addExerciseLog(makeLog({ activity: "squat" }));
    await addExerciseLog(makeLog({ activity: "squat" }));
    await addExerciseLog(makeLog({ activity: "row" }));

    const names = (await getAllExerciseNames()).map((entry) => entry.name).sort();
    expect(names).toEqual(["row", "squat"]);
  });

  test("is rejected by the SDK when a field is explicitly undefined, writing nothing", async () => {
    const error = await caught(() => addExerciseLog(makeLog({ notes: undefined })));

    expect(error.message).toMatch(/Unsupported field value: undefined/);
    expect(await logsOf()).toEqual([]);
  });
});

describe("reading workouts back", () => {
  test("filters a date range on the server, boundaries included", async () => {
    for (const date of ["2026-05-31", "2026-06-01", "2026-06-15", "2026-06-30", "2026-07-01"]) {
      await addExerciseLog(makeLog({ date }));
    }

    const { uniqueDates } = await getExerciseLogsByDateRange("2026-06-01", "2026-06-30");

    expect(uniqueDates).toEqual(["2026-06-01", "2026-06-15", "2026-06-30"]);
  });

  test("builds a calendar month, including a leap day", async () => {
    await addExerciseLog(makeLog({ date: "2028-02-29" }));
    await addExerciseLog(makeLog({ date: "2028-03-01" }));

    const { uniqueDates } = await getExerciseLogsByMonth("2028-02");

    expect(uniqueDates).toEqual(["2028-02-29"]);
  });

  test("returns the four latest sessions of one exercise, newest first", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      ids.push(await addExerciseLog(makeLog({ activity: "deadlift", notes: `session ${i}` })));
    }
    await addExerciseLog(makeLog({ activity: "row" }));

    const latest = await getLatestExercisesByName("deadlift");

    expect(latest.map((log) => log.notes)).toEqual(["session 5", "session 4", "session 3", "session 2"]);
  });
});

describe("editing and deleting", () => {
  test("an edit replaces the fields but keeps the original server timestamp", async () => {
    const id = await addExerciseLog(makeLog({ activity: "bench press" }));
    const created = (await readAsAdmin(`users/${user.uid}/fitnessLogs/${id}`))?.createdAt;

    await editExerciseLog(id, makeLog({ activity: "incline bench" }));

    const stored = await readAsAdmin(`users/${user.uid}/fitnessLogs/${id}`);
    expect(stored?.activity).toBe("incline bench");
    expect(stored?.createdAt.isEqual(created)).toBe(true);
  });

  test("editing a log that does not exist says it was not found and writes nothing", async () => {
    const error = await caught(() => editExerciseLog("missing", makeLog()));

    expect(error.message).toBe("Fitness log not found.");
    expect(await logsOf()).toEqual([]);
  });

  test("deleting removes the log but keeps the remembered name", async () => {
    const id = await addExerciseLog(makeLog({ activity: "squat" }));

    await deleteExerciseLog(id);

    expect(await logsOf()).toEqual([]);
    expect((await getAllExerciseNames()).map((n) => n.name)).toEqual(["squat"]);
  });

  test("reading a log that does not exist says it was not found", async () => {
    await expect(getExerciseLogById("missing")).rejects.toThrow("Fitness log not found.");
  });

  test("deleting a log that does not exist fails", async () => {
    await expect(deleteExerciseLog("missing")).rejects.toThrow("Fitness log not found.");
  });

  // FIXME: references an undeclared `name`; on device it always throws.
  test.failing("deletes a remembered exercise name", async () => {
    await addExerciseLog(makeLog({ activity: "squat" }));
    const [{ id }] = await getAllExerciseNames();

    await deleteExerciseName(id);

    expect(await getAllExerciseNames()).toEqual([]);
  });
});

describe("syncing the offline queue", () => {
  test("uploads queued logs with server timestamps and one name each", async () => {
    await syncOfflineExercises([
      makeLog({ activity: "squat", date: getTodayString() }),
      makeLog({ activity: "squat", date: getTodayString() }),
      makeLog({ activity: "lunge", date: getTodayString() }),
    ]);

    expect(await logsOf()).toHaveLength(3);
    expect((await getAllExerciseNames()).map((n) => n.name).sort()).toEqual(["lunge", "squat"]);
  });

  test("refuses a sync right after another log was written", async () => {
    await addExerciseLog(makeLog());

    const error = await caught(() => syncOfflineExercises([makeLog()]));

    expect(error.message).toBe("Last offline log made less then 10 seconds ago.");
    expect(await logsOf()).toHaveLength(1);
  });

  test("uploads a queue of more than 500 logs in one commit", async () => {
    // Firestore no longer caps a commit at 500 writes (removed March 2023).
    await syncOfflineExercises(Array.from({ length: 501 }, () => makeLog()));

    expect(await logsOf()).toHaveLength(501);
  });
});
