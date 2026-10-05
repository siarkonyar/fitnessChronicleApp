import { reconcileProgramLabels } from "../programLabels";
import { REST_DAY, makeTrainingDay } from "../firebase/__tests__/fixtures";

// types/types.ts reads firestore.Timestamp at import time.
jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

const owned = (id: string, label: string, description: string) => ({
  id,
  label,
  description,
  dates: ["2026-06-01"],
});

const dayLabelled = (label: string, description: string) =>
  makeTrainingDay({ label: { label, description } });

describe("reconcileProgramLabels", () => {
  test("leaves a program with no labels untouched", () => {
    const days = [REST_DAY, makeTrainingDay({ label: undefined })];

    expect(reconcileProgramLabels(days, [])).toEqual({ days, missingLabels: [] });
  });

  test("reuses the user's own emoji and casing for a matching description", () => {
    const result = reconcileProgramLabels(
      [dayLabelled("🏋️", "push")],
      [owned("l1", "💪", "Push")],
    );

    expect(result.days[0].label).toEqual({ label: "💪", description: "Push" });
    expect(result.missingLabels).toEqual([]);
  });

  test("matches descriptions regardless of surrounding whitespace and case", () => {
    const result = reconcileProgramLabels(
      [dayLabelled("L", "  LEG DAY  ")],
      [owned("l1", "🦵", "leg day")],
    );

    expect(result.days[0].label?.label).toBe("🦵");
    expect(result.missingLabels).toEqual([]);
  });

  test("does not match on the emoji, only the description", () => {
    const result = reconcileProgramLabels(
      [dayLabelled("💪", "Chest")],
      [owned("l1", "💪", "Push")],
    );

    expect(result.missingLabels).toEqual([
      { label: "💪", description: "Chest", dates: [] },
    ]);
  });

  test("does not treat a near-miss description as a match", () => {
    const result = reconcileProgramLabels(
      [dayLabelled("L", "Legs")],
      [owned("l1", "🦵", "Leg")],
    );

    expect(result.missingLabels).toHaveLength(1);
  });

  test("lists each missing label once, keeping the LAST spelling", () => {
    // Side effect worth knowing: day 0 still shows "A"/"Upper" while the label
    // created for it is "B"/"UPPER ", so the two disagree visually.
    const result = reconcileProgramLabels(
      [dayLabelled("A", "Upper"), REST_DAY, dayLabelled("B", "UPPER "), dayLabelled("C", "Lower")],
      [],
    );

    expect(result.missingLabels).toEqual([
      { label: "B", description: "UPPER ", dates: [] },
      { label: "C", description: "Lower", dates: [] },
    ]);
  });

  test("leaves unmatched days pointing at the AI's own label", () => {
    const day = dayLabelled("🤖", "Mobility");

    expect(reconcileProgramLabels([day], []).days[0]).toBe(day);
  });

  test("keeps exercises and rest flags when rewriting a label", () => {
    const day = dayLabelled("x", "Push");

    const [result] = reconcileProgramLabels([day], [owned("l1", "💪", "Push")]).days;

    expect(result.exercises).toEqual(day.exercises);
    expect(result.isRestDay).toBe(false);
  });

  test("never copies the user's label id or dates into the program", () => {
    const [result] = reconcileProgramLabels(
      [dayLabelled("x", "Push")],
      [owned("l1", "💪", "Push")],
    ).days;

    expect(result.label).not.toHaveProperty("id");
    expect(result.label).not.toHaveProperty("dates");
  });

  test("when the user owns two labels with one description, the later one wins", () => {
    const result = reconcileProgramLabels(
      [dayLabelled("x", "Push")],
      [owned("l1", "A", "Push"), owned("l2", "B", "push")],
    );

    expect(result.days[0].label).toEqual({ label: "B", description: "push" });
  });

  test("does not mutate the days it was given", () => {
    const days = [dayLabelled("x", "Push")];
    const snapshot = JSON.parse(JSON.stringify(days));

    reconcileProgramLabels(days, [owned("l1", "💪", "Push")]);

    expect(days).toEqual(snapshot);
  });

  test("handles an empty program", () => {
    expect(reconcileProgramLabels([], [owned("l1", "💪", "Push")])).toEqual({
      days: [],
      missingLabels: [],
    });
  });
});
