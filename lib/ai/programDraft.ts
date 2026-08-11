/**
 * Turns the AI coach's `proposeProgram` tool arguments into a real `Program`.
 *
 * The model can't emit a `SetSchema` directly — that schema is a 5-way
 * discriminated union on `measure`, which Gemini function declarations handle
 * badly. So the AI-facing shape is deliberately flat, and everything the model
 * is not allowed to choose (the unit, the rep-range vocabulary) gets filled in
 * here instead. Pure functions only — no Firestore, no Gemini SDK — which is
 * what makes this the testable core of the feature, the same way
 * formatWorkoutData.ts is for the read side.
 */
import { bucketBounds, REP_RANGE_OPTIONS } from "@/constants/RepRanges";
import { ProgramSchema } from "@/types/types";
import { z } from "zod";

type Program = z.infer<typeof ProgramSchema>;

/** Whether the user types exact reps or picks a bucket from the wheel picker. */
export type RepType = "fixed" | "range";

/**
 * The user's own settings. Read from AsyncStorage by the caller and passed in,
 * so this module stays pure and testable.
 */
export type ProgramDraftPrefs = {
  repType: RepType;
  measure: "kg" | "lbs";
};

/**
 * A label is one glyph, but "one glyph" can be many code points. Measured
 * lengths of the longest standard sequences: 👨‍👩‍👧‍👦 family of four and the
 * 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England tag-flag are 7, 👩🏻‍❤️‍👨🏿 is 8, and 👩🏽‍❤️‍💋‍👨🏻 (kiss with two skin
 * tones) is 10 — the longest one there is. 12 clears all of them with room to
 * spare, which is the right direction to err: rejecting a label makes
 * `toProgram` throw away the whole program, while accepting a slightly long one
 * just renders a wide label. Words are stopped by the letter count below, not
 * by this cap.
 */
const MAX_GLYPH_CODE_POINTS = 12;

/**
 * Reps the model is allowed to send: a plain 1-3 digit number. This is what
 * stops it sneaking a range like "5-6" past us — turning a number into a range
 * is `toReps`'s job, because only the app knows the user's preference.
 */
const EXACT_REPS_PATTERN = /^\d{1,3}$/;

/**
 * The model always sends a plain number ("8"). If the user prefers ranges, snap
 * it to the first bucket that contains it; otherwise return it unchanged.
 */
export function toReps(exactReps: string, repType: RepType): string {
  if (repType === "fixed") return exactReps;

  const num = Number(exactReps);

  const match = REP_RANGE_OPTIONS.find((option) => {
    const { min, max } = bucketBounds(option);
    return num >= min && num <= max;
  });

  return match ?? REP_RANGE_OPTIONS[0];
}

/**
 * A label's `label` field must be a single emoji or a single letter — the
 * readable name lives in `description`. Nothing else in the codebase enforces
 * this, so this function is the only thing standing between the model and a
 * malformed label.
 */
export function isLabelGlyph(value: string): boolean {
  if (value.length === 0) return false;
  if (/\s/.test(value)) return false;

  // Array.from splits by code point, so a surrogate pair counts as one.
  const codePoints = Array.from(value);
  if (codePoints.length > MAX_GLYPH_CODE_POINTS) return false;

  // A character is a letter when it has two distinct cases. That works for any
  // alphabet without \p{...} escapes, which Hermes doesn't reliably support.
  const alphanumerics = codePoints.filter(
    (char) => char.toLowerCase() !== char.toUpperCase() || /\d/.test(char),
  );

  return alphanumerics.length <= 1;
}

/** The flat shape the model is asked to produce. */
export const ProgramDraftArgsSchema = z
  .object({
    name: z.string().min(1),
    days: z.array(
      z.object({
        isRestDay: z.boolean(),
        labelEmoji: z.string().optional(),
        labelDescription: z.string().min(1).max(100).optional(),
        exercises: z
          .array(
            z.object({
              activity: z.string().min(3).max(100),
              notes: z.string().max(500).optional(),
              sets: z
                .array(
                  z.object({
                    setType: z.enum(["warmup", "normal", "drop", "failure"]),
                    reps: z.string(),
                  }),
                )
                .min(1),
            }),
          )
          .optional(),
      }),
    ),
  })
  .superRefine((args, ctx) => {
    args.days.forEach((day, dayIndex) => {
      const hasEmoji = day.labelEmoji !== undefined;
      const hasDescription = day.labelDescription !== undefined;

      if (hasEmoji !== hasDescription) {
        ctx.addIssue({
          code: "custom",
          path: ["days", dayIndex, "labelEmoji"],
          message:
            "labelEmoji and labelDescription must be sent together, or not at all",
        });
      }

      if (day.labelEmoji !== undefined && !isLabelGlyph(day.labelEmoji)) {
        ctx.addIssue({
          code: "custom",
          path: ["days", dayIndex, "labelEmoji"],
          message:
            "labelEmoji must be one emoji or one letter — the readable name goes in labelDescription",
        });
      }

      const exerciseCount = day.exercises?.length ?? 0;

      if (day.isRestDay && exerciseCount > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["days", dayIndex, "exercises"],
          message: "a rest day cannot have exercises",
        });
      }

      if (!day.isRestDay && exerciseCount === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["days", dayIndex, "exercises"],
          message: "a training day needs at least one exercise",
        });
      }

      day.exercises?.forEach((exercise, exerciseIndex) => {
        exercise.sets.forEach((set, setIndex) => {
          if (EXACT_REPS_PATTERN.test(set.reps)) return;

          ctx.addIssue({
            code: "custom",
            path: [
              "days",
              dayIndex,
              "exercises",
              exerciseIndex,
              "sets",
              setIndex,
              "reps",
            ],
            message: `reps must be a plain number like "8", never a range`,
          });
        });
      });
    });
  });

/**
 * Validates the model's arguments and builds the `Program` the app stores.
 * Returns null when the arguments are unusable — the caller decides whether to
 * tell the model to retry.
 */
export function toProgram(
  args: unknown,
  prefs: ProgramDraftPrefs,
): Program | null {
  const parsedArgs = ProgramDraftArgsSchema.safeParse(args);
  if (!parsedArgs.success) return null;

  const days = parsedArgs.data.days.map((day) => {
    // The AI sends the label as two flat fields; ProgramDaySchema wants a whole
    // LabelSchema. muscleGroups is left off deliberately — nothing populates it
    // yet, so the model has no business inventing values for it.
    const label =
      day.labelEmoji && day.labelDescription
        ? { label: day.labelEmoji, description: day.labelDescription }
        : undefined;

    const exercises = day.exercises?.map((exercise) => {
      return {
        activity: exercise.activity,
        ...(exercise.notes && { notes: exercise.notes }),
        sets: exercise.sets.map((set) => {
          return {
            setType: set.setType,
            reps: toReps(set.reps, prefs.repType),
            measure: prefs.measure,
          };
        }),
      };
    });

    return {
      isRestDay: day.isRestDay,
      ...(label && { label }),
      ...(exercises && { exercises }),
    };
  });

  return { name: parsedArgs.data.name, days };
}

/** One-line summary ("5 days, 4 training days") sent back to the model. */
export function describeProgram(program: Program): string {
  const totalDays = program.days.length;
  const trainingDays = program.days.filter((day) => !day.isRestDay).length;

  return `${totalDays} days, ${trainingDays} training days`;
}
