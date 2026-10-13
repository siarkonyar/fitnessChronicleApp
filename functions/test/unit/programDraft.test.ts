import { describe, expect, it } from "vitest";
import { describeProgram, isLabelGlyph, toProgram, toReps } from "../../src/ai/programDraft.js";
import { ProgramSchema } from "../../src/data/schemas.js";

const prefs = { repType: "fixed", measure: "lbs" } as const;
const trainingDay = () => ({
  isRestDay: false, labelEmoji: "🏋️", labelDescription: "Push",
  exercises: [{ activity: "Bench press", notes: "Slow eccentric", sets: [{ setType: "normal", reps: "8" }] }],
});
const draft = (day: unknown = trainingDay()) => ({ name: "Upper/lower", days: [day, { isRestDay: true }] });

describe("program drafts", () => {
  it("builds an app-shaped program using the caller's preferences, without model-supplied weights", () => {
    const day = trainingDay();
    Object.assign(day.exercises[0].sets[0], { value: "999", measure: "kg" });
    const original = structuredClone(day);
    const program = toProgram(draft(day), prefs);
    expect(program).toEqual({ name: "Upper/lower", days: [
      { isRestDay: false, label: { label: "🏋️", description: "Push" }, exercises: [
        { activity: "Bench press", notes: "Slow eccentric", sets: [{ setType: "normal", reps: "8", measure: "lbs" }] },
      ] }, { isRestDay: true },
    ] });
    expect(ProgramSchema.safeParse(program).success).toBe(true);
    expect(day).toEqual(original);
    expect(describeProgram(program!)).toBe("2 days, 1 training days");
  });

  it.each([
    ["1", "1"], ["2", "2"], ["3", "3-4"], ["4", "3-4"], ["6", "5-6"],
    ["8", "7-8"], ["10", "9-10"], ["11", "10-12"], ["12", "10-12"],
    ["15", "12-15"], ["20", "15-20"], ["21", "20+"], ["999", "20+"],
  ])("converts exact reps %s to the first matching picker bucket %s", (exact, expected) => {
    expect(toReps(exact, "fixed")).toBe(exact);
    expect(toReps(exact, "range")).toBe(expected);
  });

  it("applies range preferences to every set", () => {
    const program = toProgram(draft(), { measure: "kg", repType: "range" });
    expect(program?.days[0].exercises?.[0].sets).toEqual([{ measure: "kg", reps: "7-8", setType: "normal" }]);
  });

  it.each([null, {}, { name: "", days: [] }, { name: "Plan", days: [] }])("rejects malformed draft %j", (input) => {
    expect(toProgram(input, prefs)).toBeNull();
  });

  it.each([
    { isRestDay: false },
    { isRestDay: false, exercises: [] },
    { ...trainingDay(), isRestDay: true },
    { ...trainingDay(), labelEmoji: undefined },
    { ...trainingDay(), labelDescription: undefined },
    { ...trainingDay(), labelEmoji: "Push" },
    { ...trainingDay(), exercises: [{ activity: "ab", sets: [{ setType: "normal", reps: "8" }] }] },
    { ...trainingDay(), exercises: [{ activity: "Bench press", sets: [] }] },
  ])("rejects invalid day %j", (day) => {
    expect(toProgram(draft(day), prefs)).toBeNull();
  });

  it.each(["6-8", "8.5", "-1", "1000", " 8", "8 ", "eight", ""])("rejects non-exact reps %j", (reps) => {
    const day = trainingDay();
    day.exercises[0].sets[0].reps = reps;
    expect(toProgram(draft(day), prefs)).toBeNull();
  });

  it.each(["A", "ü", "🏋️", "👨‍👩‍👧‍👦", "🇬🇧", "👍🏽"])("accepts label glyph %s", (glyph) => {
    expect(isLabelGlyph(glyph)).toBe(true);
  });
  it.each(["", " ", "Push", "AB", "12", "A B", "🏋️".repeat(13)])("rejects label glyph %j", (glyph) => {
    expect(isLabelGlyph(glyph)).toBe(false);
  });
});
