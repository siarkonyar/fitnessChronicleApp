import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearAllOfflineExercises,
  deleteOfflineExercise,
  generateUniqueId,
  getDefaultMeasurement,
  getDefaultRepType,
  getHapticsEnabled,
  getOfflineExerciseById,
  getOfflineExercises,
  getOfflineExercisesByDate,
  getOfflineExercisesCount,
  hasOfflineExercises,
  offlineData,
  saveDefaultMeasurement,
  saveDefaultRepType,
  saveExerciseToStorage,
  saveHapticsEnabled,
  type OfflineExercise,
} from "../offlineStorage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const QUEUE_KEY = "offlineExercises";

const exercise = (
  overrides: Partial<Omit<OfflineExercise, "id" | "timestamp">> = {},
): Omit<OfflineExercise, "id" | "timestamp"> => ({
  date: "2026-06-10",
  activity: "squat",
  sets: [{ setType: "normal", measure: "kg", value: "100", reps: "5" }],
  ...overrides,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("generateUniqueId", () => {
  test("produces a timestamp-prefixed id", () => {
    expect(generateUniqueId()).toMatch(/^\d{13}-[a-z0-9]{1,9}$/);
  });

  test("does not repeat across many ids made in the same millisecond", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_780_000_000_000);

    const ids = new Set(Array.from({ length: 1000 }, generateUniqueId));

    expect(ids.size).toBe(1000);
  });
});

describe("offline exercise queue", () => {
  test("saves an exercise with an id and an ISO timestamp", async () => {
    const id = await saveExerciseToStorage(exercise());

    const [saved] = await getOfflineExercises();
    expect(saved).toMatchObject({ id, activity: "squat" });
    expect(new Date(saved.timestamp).toISOString()).toBe(saved.timestamp);
  });

  test("appends to the queue in the order exercises were saved", async () => {
    await saveExerciseToStorage(exercise({ activity: "first" }));
    await saveExerciseToStorage(exercise({ activity: "second" }));

    expect((await getOfflineExercises()).map((e) => e.activity)).toEqual(["first", "second"]);
  });

  test("starts empty", async () => {
    expect(await getOfflineExercises()).toEqual([]);
    expect(await hasOfflineExercises()).toBe(false);
    expect(await getOfflineExercisesCount()).toBe(0);
  });

  test("counts and reports what is queued", async () => {
    await saveExerciseToStorage(exercise());
    await saveExerciseToStorage(exercise());

    expect(await hasOfflineExercises()).toBe(true);
    expect(await getOfflineExercisesCount()).toBe(2);
  });

  test("finds one queued exercise by id, or null", async () => {
    const id = await saveExerciseToStorage(exercise());

    expect(await getOfflineExerciseById(id)).toMatchObject({ id });
    expect(await getOfflineExerciseById("nope")).toBeNull();
  });

  test("filters the queue by date", async () => {
    await saveExerciseToStorage(exercise({ date: "2026-06-10" }));
    await saveExerciseToStorage(exercise({ date: "2026-06-11" }));

    expect(await getOfflineExercisesByDate("2026-06-11")).toHaveLength(1);
    expect(await getOfflineExercisesByDate("2026-06-12")).toEqual([]);
  });

  test("deletes only the requested exercise", async () => {
    const keep = await saveExerciseToStorage(exercise());
    const drop = await saveExerciseToStorage(exercise());

    expect(await deleteOfflineExercise(drop)).toBe(true);
    expect((await getOfflineExercises()).map((e) => e.id)).toEqual([keep]);
  });

  test("reports success when deleting an id that is not queued", async () => {
    await saveExerciseToStorage(exercise());

    expect(await deleteOfflineExercise("nope")).toBe(true);
    expect(await getOfflineExercisesCount()).toBe(1);
  });

  test("clears the whole queue", async () => {
    await saveExerciseToStorage(exercise());

    expect(await clearAllOfflineExercises()).toBe(true);
    expect(await getOfflineExercises()).toEqual([]);
  });

  test("serializes the queue for upload", async () => {
    const id = await saveExerciseToStorage(exercise());

    expect(JSON.parse(await offlineData())).toEqual([
      expect.objectContaining({ id, activity: "squat" }),
    ]);
  });

  test("keeps emoji and non-Latin exercise names intact", async () => {
    await saveExerciseToStorage(exercise({ activity: "şınav 💪 腕立て" }));

    expect((await getOfflineExercises())[0].activity).toBe("şınav 💪 腕立て");
  });

  test("reads a corrupt queue as empty instead of crashing", async () => {
    await AsyncStorage.setItem(QUEUE_KEY, "{not json");

    expect(await getOfflineExercises()).toEqual([]);
    expect(await getOfflineExercisesCount()).toBe(0);
  });

  test("refuses to save on top of a corrupt queue rather than overwrite it", async () => {
    // Pinned: a corrupt queue blocks every new offline log until it is cleared.
    await AsyncStorage.setItem(QUEUE_KEY, "{not json");

    await expect(saveExerciseToStorage(exercise())).rejects.toThrow();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBe("{not json");
  });

  test("surfaces a storage failure on save", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));

    await expect(saveExerciseToStorage(exercise())).rejects.toThrow("disk full");
  });

  test("reports false when a delete or clear cannot reach storage", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    jest.spyOn(AsyncStorage, "removeItem").mockRejectedValueOnce(new Error("disk full"));

    expect(await deleteOfflineExercise("x")).toBe(false);
    expect(await clearAllOfflineExercises()).toBe(false);
  });

  // FIXME: save is read-modify-write with no lock. Two saves that overlap
  // (a double tap on "Save" offline) both read the same queue and the second
  // write drops the first exercise.
  test.failing("keeps both exercises when two saves overlap", async () => {
    await Promise.all([
      saveExerciseToStorage(exercise({ activity: "first" })),
      saveExerciseToStorage(exercise({ activity: "second" })),
    ]);

    expect(await getOfflineExercisesCount()).toBe(2);
  });
});

describe("preferences", () => {
  test("haptics default to on, and remember being turned off", async () => {
    expect(await getHapticsEnabled()).toBe(true);

    await saveHapticsEnabled(false);

    expect(await getHapticsEnabled()).toBe(false);
  });

  test("haptics fall back to on when the stored value is unreadable", async () => {
    await AsyncStorage.setItem("hapticsEnabled", "maybe");

    expect(await getHapticsEnabled()).toBe(true);
  });

  test("rep type defaults to ranges, and remembers fixed reps", async () => {
    expect(await getDefaultRepType()).toBe(false);

    await saveDefaultRepType(true);

    expect(await getDefaultRepType()).toBe(true);
  });

  test("measurement defaults to kg and remembers lbs", async () => {
    expect(await getDefaultMeasurement()).toBe("kg");

    await saveDefaultMeasurement("lbs");

    expect(await getDefaultMeasurement()).toBe("lbs");
  });

  test.each(["LBS", "stone", "", "\"lbs\""])(
    "reads an unexpected stored measurement %p as kg",
    async (stored) => {
      await AsyncStorage.setItem("defaultMeasurement", stored);

      expect(await getDefaultMeasurement()).toBe("kg");
    },
  );

  test("falls back to defaults when storage itself fails", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("io"));

    expect(await getHapticsEnabled()).toBe(true);
    expect(await getDefaultRepType()).toBe(false);
    expect(await getDefaultMeasurement()).toBe("kg");
    expect(await getOfflineExercises()).toEqual([]);
  });

  test("swallows a failure to save a preference", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("io"));

    await expect(saveHapticsEnabled(true)).resolves.toBeUndefined();
    await expect(saveDefaultRepType(true)).resolves.toBeUndefined();
    await expect(saveDefaultMeasurement("lbs")).resolves.toBeUndefined();
  });
});
