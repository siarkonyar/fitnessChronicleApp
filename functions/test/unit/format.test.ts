import { describe, expect, it } from "vitest";
import { formatLabel, formatLog, formatProgram, formatSet } from "../../src/ai/format.js";
import type { ExerciseSet } from "../../src/data/schemas.js";

describe("coach data formatting", () => {
  it.each([
    [{ measure: "kg", setType: "normal", value: "80", reps: "8" }, "80kg x 8"],
    [{ measure: "lbs", setType: "warmup", value: "45", reps: "10" }, "45lbs x 10 (warmup)"],
    [{ measure: "kg", setType: "failure" }, "?kg x ? (failure)"],
    [{ measure: "time", setType: "normal", value: "60" }, "60s"],
    [{ measure: "distance", setType: "pr", value: "5" }, "5km (pr)"],
    [{ measure: "steps", setType: "normal", value: "10000" }, "10000 steps"],
    [{ measure: "kg", setType: "normal", value: "0", reps: "0" }, "0kg x 0"],
  ] satisfies [ExerciseSet, string][])("formats %j as %s", (set, expected) => {
    expect(formatSet(set)).toBe(expected);
  });

  it("keeps log dates and notes, without mutating the stored sets", () => {
    const log = { date: "2026-02-28", activity: "Plank", notes: "Slow breathing", sets: [{ measure: "time", setType: "normal", value: "60" } as ExerciseSet] };
    const original = structuredClone(log);
    expect(formatLog(log)).toEqual({ date: log.date, activity: log.activity, notes: log.notes, sets: ["60s"] });
    expect(log).toEqual(original);
  });

  it("counts assigned dates and defaults missing dates to zero", () => {
    expect(formatLabel({ label: "P", description: "Push" })).toEqual({ name: "P", description: "Push", timesUsed: 0 });
    expect(formatLabel({ label: "P", description: "Push", dates: ["2026-02-01", "2026-02-03"] }).timesUsed).toBe(2);
  });

  it("numbers program days from one and preserves empty/rest days", () => {
    expect(formatProgram({ name: "Plan", days: [
      { isRestDay: true },
      { isRestDay: false, label: { label: "P", description: "Push" }, exercises: [{ activity: "Bench press", sets: [{ measure: "kg", setType: "normal", reps: "8" }] }] },
    ] })).toEqual({ name: "Plan", days: [
      { day: 1, isRestDay: true, label: undefined, exercises: undefined },
      { day: 2, isRestDay: false, label: "P", exercises: [{ activity: "Bench press", sets: ["?kg x 8"] }] },
    ] });
  });
});
