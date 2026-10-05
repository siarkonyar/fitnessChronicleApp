import {
  addWeightLog,
  deleteWeightLogById,
  getIfTodayLogged,
  getWeightByDate,
  getWeightMeasure,
  getWeights,
  updateMasure,
  updateMeasure,
} from "../weight";
import {
  TEST_UID,
  firestoreMock,
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
const weightPath = (id: string) => [...USER, "weightLogs", id];
const storedWeights = () =>
  listPaths([...USER, "weightLogs"]).map((path) => readDoc(path.split("/"))?.weight);

/** Local noon, so "today" is unambiguous whatever TZ the suite runs in. */
const NOW = new Date(2026, 5, 10, 12, 0, 0);

const seedWeights = (count: number, weight = 80) => {
  for (let i = 0; i < count; i += 1) {
    seedDoc(weightPath(`w${i}`), { weight, date: "2026-06-01" });
  }
};

beforeEach(() => {
  resetFirestore();
  mockCurrentUser = { uid: TEST_UID };
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("addWeightLog", () => {
  test("stores today's weight with the local date and a timestamp", async () => {
    await addWeightLog(81.5);

    const [path] = listPaths([...USER, "weightLogs"]);
    expect(readDoc(path.split("/"))).toEqual({
      weight: 81.5,
      measure: "kg",
      date: "2026-06-10",
      createdAt: NOW,
    });
  });

  test.each([
    [80.126, 80.13],
    [72.345, 72.35],
    [99.999, 100],
    [0.1 + 0.2, 0.3],
  ])("rounds %p to two decimals (%p)", async (input, expected) => {
    await addWeightLog(input);

    expect(storedWeights()).toEqual([expected]);
  });

  test("rounds 1.005 down, because 1.005 is not exactly representable", async () => {
    await addWeightLog(1.005);

    expect(storedWeights()).toEqual([1]);
  });

  test("adds a second entry on the same day rather than replacing the first", async () => {
    // The screen uses getIfTodayLogged to prevent this; the helper does not.
    await addWeightLog(80);
    await addWeightLog(79);

    expect(storedWeights().sort()).toEqual([79, 80]);
  });

  test("uses the device's calendar day just before midnight", async () => {
    jest.setSystemTime(new Date(2026, 5, 10, 23, 59, 59));

    await addWeightLog(80);

    const [path] = listPaths([...USER, "weightLogs"]);
    expect(readDoc(path.split("/"))?.date).toBe("2026-06-10");
  });

  test("requires a signed-in user", async () => {
    mockCurrentUser = null;

    await expect(addWeightLog(80)).rejects.toThrow("User not authenticated");
  });
});

describe("getIfTodayLogged", () => {
  test("is false when nothing was logged", async () => {
    expect(await getIfTodayLogged()).toBe(false);
  });

  test("is true for an entry made earlier today", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-10", createdAt: new Date(2026, 5, 10, 7) });

    expect(await getIfTodayLogged()).toBe(true);
  });

  test("counts an entry made at exactly local midnight", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-10", createdAt: new Date(2026, 5, 10, 0, 0, 0, 0) });

    expect(await getIfTodayLogged()).toBe(true);
  });

  test("does not count an entry from one millisecond before midnight", async () => {
    seedDoc(weightPath("a"), {
      weight: 80,
      date: "2026-06-09",
      createdAt: new Date(2026, 5, 9, 23, 59, 59, 999),
    });

    expect(await getIfTodayLogged()).toBe(false);
  });

  test("does not count an entry stamped tomorrow (clock skew)", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-11", createdAt: new Date(2026, 5, 11, 0, 0, 0) });

    expect(await getIfTodayLogged()).toBe(false);
  });
});

describe("getWeights / getWeightByDate / deleteWeightLogById", () => {
  test("lists every entry with its id", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 79.4, date: "2026-06-10" });

    const weights = await getWeights();

    expect(weights.map(({ id, weight }) => [id, weight]).sort()).toEqual([
      ["a", 80],
      ["b", 79.4],
    ]);
  });

  test("filters by exact date", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 79.4, date: "2026-06-10" });

    expect((await getWeightByDate("2026-06-10")).map((w) => w.id)).toEqual(["b"]);
  });

  test("refuses to read a weight stored as a string", async () => {
    seedDoc(weightPath("a"), { weight: "80", date: "2026-06-09" });

    await expect(getWeights()).rejects.toThrow();
  });

  test("deletes one entry by id", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 79, date: "2026-06-10" });

    await deleteWeightLogById("a");

    expect(listPaths([...USER, "weightLogs"])).toEqual([`users/${TEST_UID}/weightLogs/b`]);
  });

  test("reports a missing entry as not found", async () => {
    await expect(deleteWeightLogById("missing")).rejects.toThrow("Weight log not found.");
  });
});

describe("getWeightMeasure", () => {
  test("returns the stored unit", async () => {
    seedDoc(USER, { measure: "lbs" });

    expect(await getWeightMeasure("kg")).toBe("lbs");
  });

  test("returns undefined for a user who never chose", async () => {
    expect(await getWeightMeasure("kg")).toBeUndefined();
  });
});

describe("updateMeasure", () => {
  test("a failed unit write cannot leave history converted under the old unit", async () => {
    seedDoc(USER, { measure: "kg" });
    seedWeights(451);
    const ref = firestoreMock().collection("users").doc(TEST_UID);
    const prototype = Object.getPrototypeOf(ref) as typeof ref;
    const original = prototype.set;
    const failure = jest.spyOn(prototype, "set").mockImplementation(function (this: typeof ref, data, options) {
      if (this.path === `users/${TEST_UID}` && data.measure === "lbs") {
        return Promise.reject(new Error("Simulated unit-write failure"));
      }
      return original.call(this, data, options);
    });
    try {
      await expect(updateMeasure("lbs")).rejects.toThrow("Simulated unit-write failure");
      expect(readDoc(USER)?.measure).toBe("kg");
      expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([80]));
    } finally {
      failure.mockRestore();
    }
    await updateMeasure("lbs");
    expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([176.37]));
    expect(new Set(storedWeights())).toEqual(new Set([176.37]));
  });

  test("converts every stored weight from kg to lbs and saves the unit", async () => {
    seedDoc(USER, { measure: "kg" });
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 100, date: "2026-06-10" });

    await updateMeasure("lbs");

    expect(storedWeights()).toEqual([176.37, 220.46]);
    expect(readDoc(USER)?.measure).toBe("lbs");
  });

  test("converts lbs back to kg without visible drift", async () => {
    seedDoc(USER, { measure: "kg" });
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });

    await updateMeasure("lbs");
    await updateMeasure("kg");

    expect(storedWeights()).toEqual([80]);
  });

  test("treats a user with no stored unit as kg", async () => {
    seedDoc(weightPath("a"), { weight: 80, date: "2026-06-09" });

    await updateMeasure("kg");

    expect(storedWeights()).toEqual([80]);
    expect(readDoc(USER)).toEqual({ measure: "kg" });
  });

  test("tags legacy entries without converting when the unit is unchanged", async () => {
    seedDoc(USER, { measure: "lbs" });
    seedDoc(weightPath("a"), { weight: 176.37, date: "2026-06-09" });

    await updateMeasure("lbs");

    expect(storedWeights()).toEqual([176.37]);
    expect(readDoc(weightPath("a"))?.measure).toBe("lbs");
  });

  test("skips entries whose weight is not a number", async () => {
    seedDoc(USER, { measure: "kg" });
    seedDoc(weightPath("a"), { weight: "eighty", date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 80, date: "2026-06-10" });

    await updateMeasure("lbs");

    expect(storedWeights()).toEqual(["eighty", 176.37]);
  });

  test("saves the unit even when there are no weights to convert", async () => {
    await updateMeasure("lbs");

    expect(readDoc(USER)).toEqual({ measure: "lbs" });
  });

  test("converts large histories in batches of 450", async () => {
    seedDoc(USER, { measure: "kg" });
    seedWeights(451);

    await updateMeasure("lbs");

    expect(committedBatchSizes()).toEqual([450, 1]);
    expect(new Set(storedWeights())).toEqual(new Set([176.37]));
  });

  test("does not commit an empty trailing batch on an exact multiple", async () => {
    seedDoc(USER, { measure: "kg" });
    seedWeights(900);

    await updateMeasure("lbs");

    expect(committedBatchSizes()).toEqual([450, 450]);
  });

  test("a failed second chunk leaves every weight readable and retries safely", async () => {
    seedDoc(USER, { measure: "kg" });
    seedWeights(451);
    const instance = firestoreMock();
    const original = instance.runTransaction;
    let calls = 0;
    const failure = jest.spyOn(instance, "runTransaction").mockImplementation(async (callback) => {
      calls++;
      if (calls === 2) throw new Error("Simulated chunk failure");
      return original(callback);
    });
    try {
      await expect(updateMeasure("lbs")).rejects.toThrow("Simulated chunk failure");
      expect(readDoc(USER)?.measure).toBe("kg");
      expect(new Set(storedWeights())).toEqual(new Set([80, 176.37]));
      expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([80]));
      expect((await getWeightByDate("2026-06-01"))[0].weight).toBe(80);
    } finally {
      failure.mockRestore();
    }
    await updateMeasure("lbs");
    expect(new Set(storedWeights())).toEqual(new Set([176.37]));
  });

  test("reads a mixture of tagged and legacy entries in the selected unit", async () => {
    seedDoc(USER, { measure: "lbs" });
    seedDoc(weightPath("a"), { weight: 80, measure: "kg", date: "2026-06-09" });
    seedDoc(weightPath("b"), { weight: 176.37, date: "2026-06-09" });
    expect((await getWeights()).map((entry) => entry.weight)).toEqual([176.37, 176.37]);
    expect((await getWeightByDate("2026-06-09")).map((entry) => entry.weight)).toEqual([176.37, 176.37]);
  });

  test("new entries carry their unit and repeated changes do not convert twice", async () => {
    seedDoc(USER, { measure: "lbs" });
    await addWeightLog(176.37);
    expect(readDoc(listPaths([...USER, "weightLogs"])[0].split("/"))?.measure).toBe("lbs");
    await updateMeasure("kg");
    await updateMeasure("kg");
    expect((await getWeights())[0].weight).toBe(80);
  });

  test("concurrent opposing unit changes leave values consistent with the final setting", async () => {
    seedDoc(USER, { measure: "kg" });
    seedWeights(451);
    await Promise.all([updateMeasure("lbs"), updateMeasure("kg")]);
    const expected = readDoc(USER)?.measure === "lbs" ? 176.37 : 80;
    expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([expected]));
  });

  test("keeps the old alias pointing at the same function", () => {
    expect(updateMasure).toBe(updateMeasure);
  });
});
