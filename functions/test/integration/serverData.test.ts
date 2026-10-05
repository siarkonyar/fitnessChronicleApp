import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { getExerciseLogsByDateRange, MAX_LOGS_RETURNED } from "../../src/data/exerciseLogs.js";
import { getAllLabels } from "../../src/data/labels.js";
import { getPrograms } from "../../src/data/programs.js";
import { checkQuota } from "../../src/quota/check.js";
import { recordUsage } from "../../src/quota/record.js";
import { BUCKET_CAPACITY, FREE_TOKEN_CAP, MIN_HEADROOM_TOKENS } from "../../src/quota/caps.js";
import { adminDb, createTestUser, readUsage, seedUsage, waitForUsageToExist } from "./setup.js";

let uid: string;
const log = (date: string, activity = "Squat") => ({ date, activity, sets: [{ measure: "kg", setType: "normal", value: "80", reps: "8" }] });
const collection = (name: string, user = uid) => adminDb.collection(`users/${user}/${name}`);

beforeEach(async () => {
  ({ uid } = await createTestUser());
  expect(await waitForUsageToExist(uid)).toBe(true);
});

describe("server training-data readers against Firestore", () => {
  it("includes both range boundaries, returns chronological data, and isolates the supplied user", async () => {
    const batch = adminDb.batch();
    for (const date of ["2026-01-01", "2026-01-02", "2026-01-31", "2026-02-01"]) batch.set(collection("fitnessLogs").doc(date), log(date));
    batch.set(collection("fitnessLogs", "other-user").doc("private"), log("2026-01-02", "Private exercise"));
    await batch.commit();
    const page = await getExerciseLogsByDateRange(uid, "2026-01-02", "2026-01-31");
    expect(page).toEqual({ logs: [log("2026-01-02"), log("2026-01-31")], truncated: false });
  });

  it.each([MAX_LOGS_RETURNED, MAX_LOGS_RETURNED + 1])("returns the newest logs and an accurate truncation flag for %s rows", async (count) => {
    const batch = adminDb.batch();
    for (let i = 0; i < count; i++) {
      const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
      batch.set(collection("fitnessLogs").doc(`log-${i}`), log(date));
    }
    await batch.commit();
    const page = await getExerciseLogsByDateRange(uid, "2025-01-01", "2025-12-31");
    expect(page.logs).toHaveLength(MAX_LOGS_RETURNED);
    expect(page.truncated).toBe(count > MAX_LOGS_RETURNED);
    expect(page.logs[0].date).toBe(count > MAX_LOGS_RETURNED ? "2025-01-02" : "2025-01-01");
    expect(page.logs.at(-1)?.date).toBe(new Date(Date.UTC(2025, 0, count)).toISOString().slice(0, 10));
  });

  it("skips a corrupt workout instead of failing the conversation", async () => {
    await collection("fitnessLogs").doc("good").set(log("2026-01-01"));
    await collection("fitnessLogs").doc("bad").set({ ...log("2026-01-02"), sets: [{ measure: "stone" }] });
    expect(await getExerciseLogsByDateRange(uid, "2026-01-01", "2026-01-31")).toEqual({ logs: [log("2026-01-01")], truncated: false });
  });

  it("skips invalid labels/programs, excludes missing order fields, and preserves newest-first ordering", async () => {
    const old = Timestamp.fromMillis(1000), recent = Timestamp.fromMillis(2000);
    const batch = adminDb.batch();
    batch.set(collection("labels").doc("old"), { label: "P", description: "Push", createdAt: old });
    batch.set(collection("labels").doc("new"), { label: "L", description: "Legs", createdAt: recent });
    batch.set(collection("labels").doc("bad"), { label: 42, createdAt: recent });
    batch.set(collection("labels").doc("unordered"), { label: "U", description: "No timestamp" });
    batch.set(collection("labels", "other-user").doc("private"), { label: "X", description: "Private", createdAt: recent });
    for (const [id, name, createdAt] of [["old", "Old", old], ["new", "New", recent]] as const) batch.set(collection("programs").doc(id), { name, days: [{ isRestDay: true }], createdAt });
    batch.set(collection("programs").doc("bad"), { name: "Broken", days: "wrong", createdAt: recent });
    batch.set(collection("programs").doc("unordered"), { name: "No timestamp", days: [] });
    batch.set(collection("programs", "other-user").doc("private"), { name: "Private", days: [], createdAt: recent });
    await batch.commit();
    expect((await getAllLabels(uid)).map((label) => label.description)).toEqual(["Legs", "Push"]);
    expect((await getPrograms(uid)).map((program) => program.name)).toEqual(["New", "Old"]);
  });

  it("returns empty collections and ranges without fabricating data", async () => {
    expect(await getAllLabels(uid)).toEqual([]);
    expect(await getPrograms(uid)).toEqual([]);
    expect(await getExerciseLogsByDateRange(uid, "2026-01-01", "2026-01-31")).toEqual({ logs: [], truncated: false });
  });
});

describe("quota writes against Firestore", () => {
  it("counts every concurrent successful turn using atomic increments and touches only its owner", async () => {
    await seedUsage(uid, { tokensUsed: 123 });
    const other = adminDb.doc("aiUsage/unrelated-user");
    await other.set({ tokensUsed: 99 });
    await Promise.all([100, 200, 300, 400].map((cost) => recordUsage(uid, cost)));
    expect((await readUsage(uid))?.tokensUsed).toBe(1123);
    expect((await other.get()).data()?.tokensUsed).toBe(99);
  });

  it("does not create missing usage documents for zero or negative costs", async () => {
    const absent = `${uid}-absent`;
    await recordUsage(absent, 0);
    await recordUsage(absent, -1);
    expect(await readUsage(absent)).toBeUndefined();
    await expect(recordUsage(absent, 1)).rejects.toMatchObject({ code: 5 });
  });

  it("allows the exact headroom boundary but refuses one token beyond it", async () => {
    const now = new Date();
    await seedUsage(uid, { tokensUsed: FREE_TOKEN_CAP - MIN_HEADROOM_TOKENS });
    expect(await checkQuota(uid, now, { spendRateToken: false })).toMatchObject({ allowed: true });
    await recordUsage(uid, 1);
    expect(await checkQuota(uid, now, { spendRateToken: false })).toMatchObject({ allowed: false, reason: "quota", percentUsed: 100 });
  });

  it("rolls an expired period once under contention and preserves all later metering", async () => {
    const now = new Date();
    await seedUsage(uid, { tokensUsed: FREE_TOKEN_CAP, periodEnd: new Date(now.getTime() - 1) });
    const decisions = await Promise.all(Array.from({ length: 4 }, () => checkQuota(uid, now)));
    expect(decisions.every((decision) => decision.allowed)).toBe(true);
    expect((await readUsage(uid))?.rateTokens).toBe(BUCKET_CAPACITY - 4);
    await Promise.all([111, 222, 333].map((cost) => recordUsage(uid, cost)));
    await checkQuota(uid, now, { spendRateToken: false });
    expect((await readUsage(uid))?.tokensUsed).toBe(666);
  });
});
