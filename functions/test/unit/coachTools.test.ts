import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/ai/genkit.js", async () => {
  const { genkit } = await import("genkit");
  return { ai: genkit({ plugins: [] }) };
});
vi.mock("../../src/data/exerciseLogs.js", () => ({ getExerciseLogsByDateRange: vi.fn() }));
vi.mock("../../src/data/labels.js", () => ({ getAllLabels: vi.fn() }));
vi.mock("../../src/data/programs.js", () => ({ getPrograms: vi.fn() }));

import { getExerciseLogsByDateRange } from "../../src/data/exerciseLogs.js";
import { getAllLabels } from "../../src/data/labels.js";
import { getPrograms } from "../../src/data/programs.js";
import { getWorkoutLogsTool, getLabelsTool, getProgramsTool, proposeProgramTool } from "../../src/ai/tools.js";

const options = { context: { auth: { uid: "verified-user" }, prefs: { repType: "range", measure: "lbs" } } };
const range = { startDate: "2026-01-01", endDate: "2026-01-31" };

beforeEach(() => { vi.resetAllMocks(); });

describe("coach tools with real Genkit context and validation", () => {
  it.each([getWorkoutLogsTool, getLabelsTool, getProgramsTool])("refuses missing auth for $name before reading data", async (tool) => {
    await expect(tool(range)).rejects.toThrow("No uid in context");
    expect(getExerciseLogsByDateRange).not.toHaveBeenCalled();
    expect(getAllLabels).not.toHaveBeenCalled();
    expect(getPrograms).not.toHaveBeenCalled();
  });

  it("reads workouts using verified context even if input includes somebody else's uid", async () => {
    vi.mocked(getExerciseLogsByDateRange).mockResolvedValue({ logs: [{ date: "2026-01-15", activity: "Squat", sets: [{ measure: "kg", setType: "normal", value: "80", reps: "8" }] }], truncated: true });
    const input = { ...range, uid: "victim" };
    expect(await getWorkoutLogsTool(input, options)).toEqual({ logs: [{ date: "2026-01-15", activity: "Squat", sets: ["80kg x 8"], notes: undefined }], truncated: true });
    expect(getExerciseLogsByDateRange).toHaveBeenCalledWith("verified-user", range.startDate, range.endDate);
  });

  it.each([
    { startDate: "2026-02-01", endDate: "2026-01-01" },
    { startDate: "2025-01-01", endDate: "2026-01-03" },
  ])("returns a correctable error for invalid range %j without a query", async (input) => {
    expect(await getWorkoutLogsTool(input, options)).toEqual({ error: expect.any(String) });
    expect(getExerciseLogsByDateRange).not.toHaveBeenCalled();
  });

  it.each([
    { startDate: "2026-01-01", endDate: "2026-01-01" },
    { startDate: "2024-01-01", endDate: "2025-01-01" },
  ])("accepts an inclusive boundary range %j", async (input) => {
    vi.mocked(getExerciseLogsByDateRange).mockResolvedValue({ logs: [], truncated: false });
    expect(await getWorkoutLogsTool(input, options)).toEqual({ logs: [], truncated: false });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "2026-01-00"])("rejects impossible tool date %s before Firestore", async (startDate) => {
    expect(await getWorkoutLogsTool({ startDate, endDate: "2026-12-31" }, options)).toEqual({ error: expect.any(String) });
    expect(getExerciseLogsByDateRange).not.toHaveBeenCalled();
  });

  it("rejects malformed date syntax through the tool schema", async () => {
    await expect(getWorkoutLogsTool({ startDate: "not-a-date", endDate: "2026-12-31" }, options)).rejects.toThrow();
    expect(getExerciseLogsByDateRange).not.toHaveBeenCalled();
  });

  it("formats labels and programs only for the context user", async () => {
    vi.mocked(getAllLabels).mockResolvedValue([{ label: "P", description: "Push", dates: ["2026-01-01"] }]);
    vi.mocked(getPrograms).mockResolvedValue([{ name: "Plan", days: [{ isRestDay: true }] }]);
    expect(await getLabelsTool({ uid: "victim" }, options)).toEqual({ labels: [{ name: "P", description: "Push", timesUsed: 1 }] });
    expect(await getProgramsTool({}, options)).toEqual({ programs: [{ name: "Plan", days: [{ day: 1, isRestDay: true, label: undefined, exercises: undefined }] }] });
    expect(getAllLabels).toHaveBeenCalledWith("verified-user");
    expect(getPrograms).toHaveBeenCalledWith("verified-user");
  });

  it("requires preferences for a proposal and returns only a summary", async () => {
    const draft = { name: "Recovery", days: [{ isRestDay: true }] };
    await expect(proposeProgramTool(draft)).rejects.toThrow("No prefs in context");
    expect(await proposeProgramTool(draft, options)).toEqual({ ok: true, summary: "1 days, 0 training days" });
    expect(getPrograms).not.toHaveBeenCalled();
  });

  it("propagates data failures rather than presenting them as empty workouts", async () => {
    vi.mocked(getExerciseLogsByDateRange).mockRejectedValue(new Error("Firestore unavailable"));
    await expect(getWorkoutLogsTool(range, options)).rejects.toThrow("Firestore unavailable");
  });
});
