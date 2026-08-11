/**
 * Reconciles the day labels of an AI-proposed program against the labels the
 * user already owns.
 *
 * `ProgramDaySchema.label` embeds a *copy* of a label, and the coach is free to
 * invent one the user has never created. Accepting a program must therefore
 * leave the user with every label that program references. Matching is by
 * `description` only (trimmed, case-insensitive) — on a match the day reuses the
 * user's own emoji and casing, so the program and the label list never disagree
 * visually.
 *
 * Pure functions only — no Firestore, no React — the same way programDraft.ts is
 * the testable core of the propose side.
 */
import {
  LabelSchema,
  LabelWithIdSchema,
  ProgramDaySchema,
} from "@/types/types";
import { z } from "zod";

type Label = z.infer<typeof LabelSchema>;
type LabelWithId = z.infer<typeof LabelWithIdSchema>;
type ProgramDay = z.infer<typeof ProgramDaySchema>;

export type ReconciledProgramLabels = {
  /** The days, with matched labels rewritten to the user's own label. */
  days: ProgramDay[];
  /** Labels the user does not have yet, deduped — the caller creates these. */
  missingLabels: Label[];
};

/** The matching key: same description means same label, whatever the case or padding. */
const normalizeDescription = (description: string): string =>
  description.trim().toLowerCase();

export function reconcileProgramLabels(
  days: ProgramDay[],
  existingLabels: LabelWithId[],
): ReconciledProgramLabels {
  const labelsByDescription = new Map(
    existingLabels.map((label) => [
      normalizeDescription(label.description),
      label,
    ]),
  );

  const missingByDescription = new Map<string, Label>();

  const reconciledDays = days.map((day) => {
    if (!day.label) return day;

    const existing = labelsByDescription.get(
      normalizeDescription(day.label.description),
    );
    if (!existing) {
      missingByDescription.set(normalizeDescription(day.label.description), {
        label: day.label.label,
        description: day.label.description,
        dates: [],
      });
      return day;
    }

    return {
      ...day,
      label: {
        label: existing.label,
        description: existing.description,
      },
    };
  });

  return {
    days: reconciledDays,
    missingLabels: [...missingByDescription.values()],
  };
}
