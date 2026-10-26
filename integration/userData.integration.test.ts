/**
 * Programs, body weight, settings and profile against the real emulators —
 * including the Auth emulator for the display name and the server-side
 * consent trigger that fires on the settings write.
 */
import firestore from "./shims/firestore";
import { addProgram, deleteProgram, getProgram, getPrograms, updateProgram } from "@/lib/firebase/program";
import { getStreak, updateStreak } from "@/lib/firebase/streaks";
import { getUserProfile, getUserSettings, updateUserProfile, updateUserSettings } from "@/lib/firebase/user";
import {
  addWeightLog,
  deleteWeightLogById,
  getIfTodayLogged,
  getWeights,
  updateMeasure,
} from "@/lib/firebase/weight";
import { REST_DAY, makeTrainingDay } from "@/lib/firebase/__tests__/fixtures";
import {
  adminAuth,
  adminDb,
  caught,
  readAsAdmin,
  signUpNewUser,
  waitFor,
  type TestUser,
} from "./support/emulator";

let user: TestUser;

beforeEach(async () => {
  user = await signUpNewUser();
});

describe("programs", () => {
  test("a program round-trips with its days, labels and sets intact", async () => {
    const days = [makeTrainingDay(), REST_DAY, makeTrainingDay({ label: { label: "🦵", description: "Legs" } })];

    const id = await addProgram("PPL", days);

    expect(await getProgram(id)).toMatchObject({ id, name: "PPL", days });
  });

  test("lists programs newest first by server timestamp", async () => {
    await addProgram("First", []);
    await addProgram("Second", []);

    expect((await getPrograms()).map((program) => program.name)).toEqual(["Second", "First"]);
  });

  test("an update replaces only what it names", async () => {
    const id = await addProgram("Old", [REST_DAY]);

    await updateProgram(id, { name: "New" });

    expect(await getProgram(id)).toMatchObject({ name: "New", days: [REST_DAY] });
  });

  test("an update with an undefined field is refused by the SDK", async () => {
    const id = await addProgram("P", [REST_DAY]);

    const error = await caught(() => updateProgram(id, { name: undefined }));

    expect(error.message).toMatch(/Unsupported field value: undefined/);
  });

  test("updating a program that does not exist fails with not-found", async () => {
    expect((await caught(() => updateProgram("missing", { name: "x" }))).code).toBe("firestore/not-found");
  });

  test("deleting removes it from the list", async () => {
    const id = await addProgram("Gone", []);

    await deleteProgram(id);

    expect(await getPrograms()).toEqual([]);
  });

  test("reading a missing program says it was not found", async () => {
    await expect(getProgram("missing")).rejects.toThrow("Program not found.");
  });
});

describe("body weight", () => {
  test("a failed settings write leaves mixed-unit history readable and retryable", async () => {
    await updateUserSettings({ measure: "kg" });
    const batch = adminDb.batch();
    for (let i = 0; i < 451; i++) {
      batch.set(adminDb.doc(`users/${user.uid}/weightLogs/w${i}`), { weight: 80, date: "2026-01-01" });
    }
    await batch.commit();
    const ref = firestore().collection("users").doc(user.uid);
    const prototype = Object.getPrototypeOf(ref) as typeof ref;
    const original = prototype.set;
    const failure = jest.spyOn(prototype, "set").mockImplementation(function (this: typeof ref, data, options) {
      if (this.path === ref.path && data.measure === "lbs") return Promise.reject(new Error("Simulated settings failure"));
      return original.call(this, data, options);
    });
    try {
      await expect(updateMeasure("lbs")).rejects.toThrow("Simulated settings failure");
      expect((await readAsAdmin(ref.path))?.measure).toBe("kg");
      expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([80]));
    } finally {
      failure.mockRestore();
    }
    await updateMeasure("lbs");
    expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([176.37]));
    await updateMeasure("kg");
    expect(new Set((await getWeights()).map((entry) => entry.weight))).toEqual(new Set([80]));
  });

  test("concurrent migration and new entries retain their explicit units", async () => {
    await updateUserSettings({ measure: "kg" });
    await addWeightLog(80);
    await Promise.all([updateMeasure("lbs"), addWeightLog(80)]);
    const logs = (await adminDb.collection(`users/${user.uid}/weightLogs`).get()).docs.map((doc) => doc.data());
    expect(logs).toHaveLength(2);
    expect(logs.every((log) => ["kg", "lbs"].includes(log.measure))).toBe(true);
    const expected = logs.map((log) => log.measure === "kg" ? Math.round(log.weight * 2.2046226218 * 100) / 100 : log.weight).sort();
    expect((await getWeights()).map((entry) => entry.weight).sort()).toEqual(expected);
  });

  test("logs today's weight and reports today as logged", async () => {
    expect(await getIfTodayLogged()).toBe(false);

    await addWeightLog(80.126);

    expect(await getIfTodayLogged()).toBe(true);
    expect((await getWeights()).map((entry) => entry.weight)).toEqual([80.13]);
  });

  test("switching units converts tagged history transactionally, then back again", async () => {
    await addWeightLog(80);
    await addWeightLog(100);

    await updateMeasure("lbs");
    expect((await getWeights()).map((entry) => entry.weight).sort()).toEqual([176.37, 220.46]);
    expect((await readAsAdmin(`users/${user.uid}`))?.measure).toBe("lbs");

    await updateMeasure("kg");
    expect((await getWeights()).map((entry) => entry.weight).sort()).toEqual([100, 80]);
  });

  test("converts a history larger than one 450-write chunk", async () => {
    const batch = adminDb.batch();
    for (let i = 0; i < 451; i += 1) {
      batch.set(adminDb.doc(`users/${user.uid}/weightLogs/w${i}`), { weight: 50, date: "2026-01-01" });
    }
    await batch.commit();

    await updateMeasure("lbs");

    const weights = await getWeights();
    expect(weights).toHaveLength(451);
    expect(new Set(weights.map((entry) => entry.weight))).toEqual(new Set([110.23]));
  });

  test("deletes one entry", async () => {
    await addWeightLog(80);
    const [entry] = await getWeights();

    await deleteWeightLogById(entry.id);

    expect(await getWeights()).toEqual([]);
  });
});

describe("streaks", () => {
  test("a user who never logged reads 0 and is written a zero streak", async () => {
    expect(await getStreak()).toBe(0);

    await updateStreak(new Date());

    expect(await readAsAdmin(`users/${user.uid}`)).toEqual({ streakWeeks: 0 });
  });
});

describe("settings", () => {
  test("a new user gets kg written as their default", async () => {
    expect(await getUserSettings()).toEqual({ measure: "kg" });
    expect(await readAsAdmin(`users/${user.uid}`)).toEqual({ measure: "kg" });
  });

  test("updates merge into the document without touching the streak", async () => {
    await adminDb.doc(`users/${user.uid}`).set({ measure: "kg", streakWeeks: 3 });

    await updateUserSettings({ activeProgramId: "p1", activeProgramDay: 0, activeProgramDayDate: "2026-06-10" });

    expect(await readAsAdmin(`users/${user.uid}`)).toEqual({
      measure: "kg",
      streakWeeks: 3,
      activeProgramId: "p1",
      activeProgramDay: 0,
      activeProgramDayDate: "2026-06-10",
    });
  });

  test("changing analytics consent leaves a server-side audit record", async () => {
    await updateUserSettings({ analyticsConsent: true });
    await updateUserSettings({ analyticsConsent: false });

    const recorded = await waitFor(async () => {
      const events = await adminDb.collection("consentEvents").where("uid", "==", user.uid).get();
      return events.size === 2;
    });
    expect(recorded).toBe(true);

    const events = (await adminDb.collection("consentEvents").where("uid", "==", user.uid).get()).docs
      .map((doc) => doc.data())
      .sort((a, b) => a.at.toMillis() - b.at.toMillis());
    expect(events.map(({ granted, previous, setting }) => ({ granted, previous, setting }))).toEqual([
      { granted: true, previous: null, setting: "analytics" },
      { granted: false, previous: true, setting: "analytics" },
    ]);
  });

  test("an unrelated settings write records no consent change", async () => {
    await updateUserSettings({ analyticsConsent: true });
    await waitFor(async () => (await adminDb.collection("consentEvents").where("uid", "==", user.uid).get()).size === 1);

    await updateUserSettings({ measure: "lbs" });
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    expect((await adminDb.collection("consentEvents").where("uid", "==", user.uid).get()).size).toBe(1);
  });
});

describe("profile", () => {
  test("saves the profile and mirrors the name onto the Auth account", async () => {
    await updateUserProfile({ name: "Sam", birthday: "2000-02-29", gender: "non_binary" });

    expect(await getUserProfile()).toEqual({ name: "Sam", birthday: "2000-02-29", gender: "non_binary" });
    expect((await adminAuth.getUser(user.uid)).displayName).toBe("Sam");
  });

  test("an empty name clears the Auth display name", async () => {
    await updateUserProfile({ name: "Sam" });

    await updateUserProfile({ name: "" });

    expect((await adminAuth.getUser(user.uid)).displayName ?? "").toBe("");
  });
});
