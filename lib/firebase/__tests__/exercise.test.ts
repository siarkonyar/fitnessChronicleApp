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
} from "../exercise";
import { getISOWeek } from "../../dateUtils";
import { kgSet, makeLog } from "./fixtures";
import {
  FakeTimestamp,
  TEST_UID,
  committedBatchSizes,
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

const USER = ["users", TEST_UID];
const logPath = (id: string) => [...USER, "fitnessLogs", id];
const userLogs = () => listPaths([...USER, "fitnessLogs"]);
const userNames = () => listPaths([...USER, "exerciseNames"]);

/** Wednesday noon UTC, so the ISO week is the same in every time zone. */
const NOW = new Date("2026-06-10T12:00:00Z");
const THIS_WEEK = getISOWeek(NOW);

beforeEach(() => {
  resetFirestore();
  mockCurrentUser = { uid: TEST_UID };
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("addExerciseLog", () => {
  test("stores the log with a server timestamp and returns its id", async () => {
    const id = await addExerciseLog(makeLog());

    const stored = readDoc(logPath(id));
    expect(stored).toMatchObject({ activity: "bench press", date: "2026-06-10" });
    expect(stored?.createdAt).toEqual(NOW);
  });

  test("starts a one-week streak on a user's very first log", async () => {
    await addExerciseLog(makeLog());

    expect(readDoc(USER)).toEqual({ streakWeeks: 1, lastLoggedWeek: THIS_WEEK });
  });

  test("extends the streak when the previous log was last week", async () => {
    seedDoc(USER, { streakWeeks: 4, lastLoggedWeek: "2026-W23" });

    await addExerciseLog(makeLog());

    expect(THIS_WEEK).toBe("2026-W24");
    expect(readDoc(USER)).toMatchObject({ streakWeeks: 5, lastLoggedWeek: "2026-W24" });
  });

  test("does not count a second log in the same week twice", async () => {
    await addExerciseLog(makeLog());
    await addExerciseLog(makeLog({ activity: "squat" }));
    await addExerciseLog(makeLog({ activity: "deadlift" }));

    expect(readDoc(USER)?.streakWeeks).toBe(1);
  });

  test("restarts the streak at 1 after a skipped week", async () => {
    seedDoc(USER, { streakWeeks: 12, lastLoggedWeek: "2026-W22" });

    await addExerciseLog(makeLog());

    expect(readDoc(USER)?.streakWeeks).toBe(1);
  });

  test("keeps unrelated fields on the user document when updating the streak", async () => {
    seedDoc(USER, { measure: "lbs", name: "Sam", streakWeeks: 1, lastLoggedWeek: "2026-W23" });

    await addExerciseLog(makeLog());

    expect(readDoc(USER)).toMatchObject({ measure: "lbs", name: "Sam", streakWeeks: 2 });
  });

  test("carries a streak across New Year into a 53-week year", async () => {
    // 2026 starts on a Thursday, so it has an ISO week 53.
    jest.setSystemTime(new Date("2027-01-06T12:00:00Z"));
    seedDoc(USER, { streakWeeks: 30, lastLoggedWeek: "2026-W53" });

    await addExerciseLog(makeLog({ date: "2027-01-06" }));

    expect(readDoc(USER)).toMatchObject({ streakWeeks: 31, lastLoggedWeek: "2027-W01" });
  });

  test("treats W52 as two weeks before W01 when the year had a week 53", async () => {
    jest.setSystemTime(new Date("2027-01-06T12:00:00Z"));
    seedDoc(USER, { streakWeeks: 30, lastLoggedWeek: "2026-W52" });

    await addExerciseLog(makeLog({ date: "2027-01-06" }));

    expect(readDoc(USER)?.streakWeeks).toBe(1);
  });

  test("carries a streak from W52 into W01 when the year had no week 53", async () => {
    jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    seedDoc(USER, { streakWeeks: 3, lastLoggedWeek: "2025-W52" });

    await addExerciseLog(makeLog({ date: "2026-01-01" }));

    expect(readDoc(USER)).toMatchObject({ streakWeeks: 4, lastLoggedWeek: "2026-W01" });
  });

  test("credits the streak to the week of logging, not the workout date", async () => {
    // Current behaviour: backfilling last month's workout still counts as
    // training this week. Pinned so a change to that rule is deliberate.
    await addExerciseLog(makeLog({ date: "2026-05-01" }));

    expect(readDoc(USER)?.lastLoggedWeek).toBe(THIS_WEEK);
  });

  test("remembers a new exercise name exactly once", async () => {
    await addExerciseLog(makeLog());
    await addExerciseLog(makeLog());

    const names = userNames().map((path) => readDoc(path.split("/"))?.name);
    expect(names).toEqual(["bench press"]);
  });

  test("treats names that differ only in case as different exercises", async () => {
    // The log screen lowercases names before saving; this layer does not.
    await addExerciseLog(makeLog({ activity: "Bench Press" }));
    await addExerciseLog(makeLog({ activity: "bench press" }));

    expect(userNames()).toHaveLength(2);
  });

  test("refuses to write anything when nobody is signed in", async () => {
    mockCurrentUser = null;

    await expect(addExerciseLog(makeLog())).rejects.toThrow("User not authenticated");
    expect(listPaths()).toEqual([]);
  });

  test("rejects an explicitly undefined optional field, as the native SDK does", async () => {
    // A caller spreading `{ notes: undefined }` crashes the write on device.
    await expect(addExerciseLog(makeLog({ notes: undefined }))).rejects.toThrow(
      "Unsupported field value: undefined",
    );
  });

  test("never writes into another user's data", async () => {
    seedDoc(["users", "someone-else"], { streakWeeks: 9, lastLoggedWeek: "2026-W23" });

    await addExerciseLog(makeLog());

    expect(readDoc(["users", "someone-else"])).toEqual({
      streakWeeks: 9,
      lastLoggedWeek: "2026-W23",
    });
    expect(listPaths(["users", "someone-else"])).toEqual([]);
  });
});

describe("getExerciseLogByDate", () => {
  test("returns only the logs for that exact date, with their ids", async () => {
    seedDoc(logPath("a"), makeLog({ date: "2026-06-10" }));
    seedDoc(logPath("b"), makeLog({ date: "2026-06-10", activity: "squat" }));
    seedDoc(logPath("c"), makeLog({ date: "2026-06-11" }));

    const logs = await getExerciseLogByDate("2026-06-10");

    expect(logs.map((log) => log.id).sort()).toEqual(["a", "b"]);
  });

  test("returns an empty list for a rest day", async () => {
    expect(await getExerciseLogByDate("2026-06-10")).toEqual([]);
  });

  test("converts a stored Firestore Timestamp into a Date", async () => {
    const createdAt = new Date("2026-06-10T08:00:00Z");
    seedDoc(logPath("a"), { ...makeLog(), createdAt: FakeTimestamp.fromDate(createdAt) });

    const [log] = await getExerciseLogByDate("2026-06-10");

    expect(log.createdAt).toEqual(createdAt);
  });

  test("ignores logs that belong to another user", async () => {
    seedDoc(["users", "other", "fitnessLogs", "x"], makeLog());

    expect(await getExerciseLogByDate("2026-06-10")).toEqual([]);
  });

  test("fails the whole day when one stored log is corrupt", async () => {
    // A single document written by an old build with a 2-letter name makes
    // the day unreadable. Pinned so tolerant parsing is a conscious change.
    seedDoc(logPath("good"), makeLog());
    seedDoc(logPath("bad"), makeLog({ activity: "ab" }));

    await expect(getExerciseLogByDate("2026-06-10")).rejects.toThrow();
  });
});

describe("getExerciseLogsByDateRange", () => {
  test("includes both boundary dates and returns sorted unique dates", async () => {
    seedDoc(logPath("before"), makeLog({ date: "2026-05-31" }));
    seedDoc(logPath("first"), makeLog({ date: "2026-06-01" }));
    seedDoc(logPath("mid1"), makeLog({ date: "2026-06-15" }));
    seedDoc(logPath("mid2"), makeLog({ date: "2026-06-15", activity: "squat" }));
    seedDoc(logPath("last"), makeLog({ date: "2026-06-30" }));
    seedDoc(logPath("after"), makeLog({ date: "2026-07-01" }));

    const { logs, uniqueDates } = await getExerciseLogsByDateRange("2026-06-01", "2026-06-30");

    expect(logs).toHaveLength(4);
    expect(uniqueDates).toEqual(["2026-06-01", "2026-06-15", "2026-06-30"]);
  });

  test("caps the result at 200 logs", async () => {
    for (let i = 0; i < 205; i += 1) {
      seedDoc(logPath(`log-${i}`), makeLog());
    }

    const { logs } = await getExerciseLogsByDateRange("2026-06-01", "2026-06-30");

    expect(logs).toHaveLength(200);
  });

  test("returns nothing when the range is reversed", async () => {
    seedDoc(logPath("a"), makeLog({ date: "2026-06-10" }));

    const result = await getExerciseLogsByDateRange("2026-06-30", "2026-06-01");

    expect(result).toEqual({ logs: [], uniqueDates: [] });
  });
});

describe("getExerciseLogsByMonth", () => {
  test("includes 29 February in a leap year", async () => {
    seedDoc(logPath("leap"), makeLog({ date: "2028-02-29" }));
    seedDoc(logPath("march"), makeLog({ date: "2028-03-01" }));

    const { uniqueDates } = await getExerciseLogsByMonth("2028-02");

    expect(uniqueDates).toEqual(["2028-02-29"]);
  });

  test("covers New Year's Eve and stops before January", async () => {
    seedDoc(logPath("nye"), makeLog({ date: "2026-12-31" }));
    seedDoc(logPath("ny"), makeLog({ date: "2027-01-01" }));

    const { uniqueDates } = await getExerciseLogsByMonth("2026-12");

    expect(uniqueDates).toEqual(["2026-12-31"]);
  });

  test("covers the 30th but not the 1st of next month in a 30-day month", async () => {
    seedDoc(logPath("a"), makeLog({ date: "2026-04-30" }));
    seedDoc(logPath("b"), makeLog({ date: "2026-05-01" }));

    const { uniqueDates } = await getExerciseLogsByMonth("2026-04");

    expect(uniqueDates).toEqual(["2026-04-30"]);
  });

  test("silently matches nothing for an unpadded month", async () => {
    // Unlike getAllLabelsFromMonth, this does not validate its input.
    seedDoc(logPath("a"), makeLog({ date: "2026-06-10" }));

    const { logs } = await getExerciseLogsByMonth("2026-6");

    expect(logs).toEqual([]);
  });
});

describe("getExerciseLogById", () => {
  test("returns the log with its id", async () => {
    seedDoc(logPath("abc"), makeLog({ notes: "felt strong" }));

    expect(await getExerciseLogById("abc")).toMatchObject({ id: "abc", notes: "felt strong" });
  });

  test("reports a missing log as not found", async () => {
    await expect(getExerciseLogById("missing")).rejects.toThrow("Fitness log not found.");
  });
});

describe("editExerciseLog", () => {
  test("replaces the edited fields and keeps the original createdAt", async () => {
    const createdAt = new Date("2026-06-01T07:00:00Z");
    seedDoc(logPath("abc"), { ...makeLog(), createdAt });

    const result = await editExerciseLog(
      "abc",
      makeLog({ activity: "incline bench", sets: [kgSet({ value: "70" })] }),
    );

    expect(result).toEqual({ id: "abc", message: "Fitness log updated successfully!" });
    expect(readDoc(logPath("abc"))).toMatchObject({
      activity: "incline bench",
      sets: [{ value: "70" }],
      createdAt,
    });
  });

  test("can change the date a log belongs to", async () => {
    seedDoc(logPath("abc"), makeLog({ date: "2026-06-10" }));

    await editExerciseLog("abc", makeLog({ date: "2026-06-09" }));

    expect(await getExerciseLogByDate("2026-06-10")).toEqual([]);
    expect(await getExerciseLogByDate("2026-06-09")).toHaveLength(1);
  });

  test("does not create a document when the log is missing", async () => {
    await expect(editExerciseLog("missing", makeLog())).rejects.toThrow();
    expect(userLogs()).toEqual([]);
  });

  test("reports a missing log with the not-found message", async () => {
    await expect(editExerciseLog("missing", makeLog())).rejects.toThrow("Fitness log not found.");
  });
});

describe("deleteExerciseLog", () => {
  test("removes only the requested log", async () => {
    seedDoc(logPath("keep"), makeLog());
    seedDoc(logPath("drop"), makeLog());

    await deleteExerciseLog("drop");

    expect(userLogs()).toEqual(["users/test-user/fitnessLogs/keep"]);
  });

  test("leaves the remembered exercise name in place", async () => {
    const id = await addExerciseLog(makeLog());

    await deleteExerciseLog(id);

    expect(userNames()).toHaveLength(1);
  });

  test("reports a missing log as not found", async () => {
    await expect(deleteExerciseLog("missing")).rejects.toThrow("Fitness log not found.");
  });
});

describe("getAllExerciseNames", () => {
  test("lists every remembered name with its id", async () => {
    seedDoc([...USER, "exerciseNames", "n1"], { name: "squat" });
    seedDoc([...USER, "exerciseNames", "n2"], { name: "row" });

    const names = await getAllExerciseNames();

    expect(names.map(({ id, name }) => [id, name]).sort()).toEqual([
      ["n1", "squat"],
      ["n2", "row"],
    ]);
  });

  test("returns an empty list for a new user", async () => {
    expect(await getAllExerciseNames()).toEqual([]);
  });
});

describe("getLatestExercisesByName", () => {
  const seedAt = (id: string, activity: string, iso: string) =>
    seedDoc(logPath(id), { ...makeLog({ activity }), createdAt: new Date(iso) });

  test("returns the four most recent logs of that exercise, newest first", async () => {
    seedAt("d1", "squat", "2026-06-01T10:00:00Z");
    seedAt("d2", "squat", "2026-06-02T10:00:00Z");
    seedAt("d3", "squat", "2026-06-03T10:00:00Z");
    seedAt("d4", "squat", "2026-06-04T10:00:00Z");
    seedAt("d5", "squat", "2026-06-05T10:00:00Z");
    seedAt("other", "bench press", "2026-06-06T10:00:00Z");

    const logs = await getLatestExercisesByName("squat");

    expect(logs.map((log) => log.id)).toEqual(["d5", "d4", "d3", "d2"]);
  });

  test("returns an empty list for an exercise never logged", async () => {
    expect(await getLatestExercisesByName("squat")).toEqual([]);
  });

  test("skips logs written without a createdAt, as Firestore's orderBy does", async () => {
    seedDoc(logPath("legacy"), makeLog({ activity: "squat" }));
    seedAt("new", "squat", "2026-06-05T10:00:00Z");

    const logs = await getLatestExercisesByName("squat");

    expect(logs.map((log) => log.id)).toEqual(["new"]);
  });

  test("matches the name exactly", async () => {
    seedAt("a", "Squat", "2026-06-05T10:00:00Z");

    expect(await getLatestExercisesByName("squat")).toEqual([]);
  });
});

describe("deleteExerciseName", () => {
  // FIXME: the query filters on an undeclared `name` instead of the nameId
  // argument, and reads `doc.data.name` instead of `doc.data().name`. On device
  // the call throws, so deleting a suggestion in ExerciseNameInput never works.
  test.failing("deletes the remembered exercise name", async () => {
    seedDoc([...USER, "exerciseNames", "n1"], { name: "squat" });

    await deleteExerciseName("n1");

    expect(userNames()).toEqual([]);
  });
});

describe("syncOfflineExercises", () => {
  test("does nothing for an empty queue", async () => {
    await syncOfflineExercises([]);

    expect(listPaths()).toEqual([]);
  });

  test("uploads every queued log in one batch and updates the streak", async () => {
    await syncOfflineExercises([
      makeLog({ activity: "squat" }),
      makeLog({ activity: "row" }),
      makeLog({ activity: "squat", date: "2026-06-09" }),
    ]);

    expect(userLogs()).toHaveLength(3);
    expect(readDoc(USER)).toEqual({ streakWeeks: 1, lastLoggedWeek: THIS_WEEK });
  });

  test("remembers each new name once, even when queued several times", async () => {
    seedDoc([...USER, "exerciseNames", "existing"], { name: "row" });

    await syncOfflineExercises([
      makeLog({ activity: "squat" }),
      makeLog({ activity: "squat" }),
      makeLog({ activity: "row" }),
    ]);

    const names = userNames().map((path) => readDoc(path.split("/"))?.name).sort();
    expect(names).toEqual(["row", "squat"]);
  });

  test("refuses a second sync within ten seconds of the last log", async () => {
    seedDoc(logPath("recent"), { ...makeLog(), createdAt: new Date(NOW.getTime() - 9_999) });

    await expect(syncOfflineExercises([makeLog()])).rejects.toThrow(
      "Last offline log made less then 10 seconds ago.",
    );
    expect(userLogs()).toEqual(["users/test-user/fitnessLogs/recent"]);
  });

  test("allows a sync exactly ten seconds after the last log", async () => {
    seedDoc(logPath("recent"), { ...makeLog(), createdAt: new Date(NOW.getTime() - 10_000) });

    await syncOfflineExercises([makeLog()]);

    expect(userLogs()).toHaveLength(2);
  });

  test("rolls back the whole queue when one queued log is invalid", async () => {
    await expect(
      syncOfflineExercises([makeLog(), makeLog({ notes: undefined })]),
    ).rejects.toThrow("Unsupported field value: undefined");

    expect(userLogs()).toEqual([]);
  });

  test("syncs a long queue in a single commit", async () => {
    // Firestore dropped its 500-writes-per-commit limit in March 2023; only
    // the 10 MiB request size still bounds one batch.
    await syncOfflineExercises(Array.from({ length: 501 }, () => makeLog()));

    expect(userLogs()).toHaveLength(501);
    expect(committedBatchSizes()[0]).toBe(501);
  });
});
