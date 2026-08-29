/**
 * Turns the coach's `proposeProgram` tool arguments into a real Program.
 *
 * Ported from lib/ai/programDraft.ts. The model cannot emit a SetSchema
 * directly — that schema is a 5-way discriminated union on `measure`, which
 * function declarations handle badly. So the AI-facing shape is deliberately
 * flat, and everything the model is not allowed to choose (the unit, the
 * rep-range vocabulary) gets filled in here instead.
 *
 * Pure functions only — no Firestore, no Genkit calls.
 */
import { z } from "genkit";
import { bucketBounds, REP_RANGE_OPTIONS } from "./repRanges.js";
import { ProgramSchema, type Program } from "../data/schemas.js";

/** Whether the user types exact reps or picks a bucket from the wheel picker. */
export type RepType = "fixed" | "range";

/**
 * The user's own settings. Device-local (AsyncStorage) on the client, so the
 * server cannot read them — they arrive in the request and reach the tool
 * through Genkit context.
 */
export interface ProgramDraftPrefs {
  repType: RepType;
  measure: "kg" | "lbs";
}

/**
 * A label is one glyph, but "one glyph" can be many code points. Measured
 * lengths of the longest standard sequences: the family-of-four and England
 * tag-flag emoji are 7 code points, a two-person couple emoji is 8, and the
 * kiss-with-two-skin-tones sequence is 10 — the longest there is. 12 clears all
 * of them with room to spare, which is the right direction to err: rejecting a
 * label throws away the whole program, while accepting a slightly long one just
 * renders a wide label. Words are stopped by the letter count below, not by
 * this cap.
 */
const MAX_GLYPH_CODE_POINTS = 12;

/**
 * Reps the model is allowed to send: a plain 1-3 digit number. This is what
 * stops it sneaking a range like "5-6" past us — turning a number into a range
 * is toReps's job, because only the app knows the user's preference.
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
 * readable name lives in `description`. Nothing else enforces this, so this
 * function is the only thing standing between the model and a malformed label.
 */
export function isLabelGlyph(value: string): boolean {
  if (value.length === 0) return false;
  if (/\s/.test(value)) return false;

  // Array.from splits by code point, so a surrogate pair counts as one.
  const codePoints = Array.from(value);
  if (codePoints.length > MAX_GLYPH_CODE_POINTS) return false;

  // A character is a letter when it has two distinct cases. That works for any
  // alphabet without \p{...} escapes.
  const alphanumerics = codePoints.filter(
    (char) => char.toLowerCase() !== char.toUpperCase() || /\d/.test(char)
  );

  return alphanumerics.length <= 1;
}

/**
 * The flat shape the model is asked to produce.
 *
 * The .describe() calls are not decoration: Genkit turns this schema into the
 * function declaration the model sees, so these replace the hand-written
 * Schema.object descriptions in lib/ai/coachTools.ts:44-94.
 */
export const ProgramDraftArgsSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe('A short program name, for example "Upper/Lower Split".'),
    days: z
      .array(
        z.object({
          isRestDay: z
            .boolean()
            .describe(
              "True for a rest day, which has no label and no exercises."
            ),
          labelEmoji: z
            .string()
            .optional()
            .describe(
              'One emoji or one letter, for example "🏋️". Never a word — the readable name goes in labelDescription.'
            ),
          labelDescription: z
            .string()
            .min(1)
            .max(100)
            .optional()
            .describe(
              'The day name, for example "Push". Call getLabels first and reuse an existing label\'s description exactly when one fits.'
            ),
          exercises: z
            .array(
              z.object({
                activity: z
                  .string()
                  .min(3)
                  .max(100)
                  .describe(
                    'The exercise name, for example "Barbell Bench Press".'
                  ),
                notes: z
                  .string()
                  .max(500)
                  .optional()
                  .describe(
                    'Optional one-line cue, for example "slow eccentric". Never a weight.'
                  ),
                sets: z
                  .array(
                    z.object({
                      setType: z
                        .enum(["warmup", "normal", "drop", "failure"])
                        .describe('Almost always "normal".'),
                      reps: z
                        .string()
                        .describe(
                          'A plain number like "8". Never a range like "6-8" — the app converts it.'
                        ),
                    })
                  )
                  .min(1)
                  .describe("One entry per set — three or four is typical."),
              })
            )
            .optional()
            .describe("The day's exercises. Omit entirely on a rest day."),
        })
      )
      .min(1)
      .describe(
        "One entry per day of the week's cycle, in order, including rest days."
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
 * Validates the model's arguments and builds the Program the app stores.
 * Returns null when the arguments are unusable — the caller decides whether to
 * tell the model to retry.
 */
export function toProgram(
  args: unknown,
  prefs: ProgramDraftPrefs
): Program | null {
  const parsedArgs = ProgramDraftArgsSchema.safeParse(args);
  if (!parsedArgs.success) return null;

  const days = parsedArgs.data.days.map((day) => {
    // The model sends the label as two flat fields; ProgramDaySchema wants a
    // whole LabelSchema. muscleGroups is left off deliberately — nothing
    // populates it yet, so the model has no business inventing values for it.
    const label =
      day.labelEmoji && day.labelDescription
        ? { label: day.labelEmoji, description: day.labelDescription }
        : undefined;

    const exercises = day.exercises?.map((exercise) => ({
      activity: exercise.activity,
      ...(exercise.notes && { notes: exercise.notes }),
      sets: exercise.sets.map((set) => ({
        setType: set.setType,
        reps: toReps(set.reps, prefs.repType),
        measure: prefs.measure,
      })),
    }));

    return {
      isRestDay: day.isRestDay,
      ...(label && { label }),
      ...(exercises && { exercises }),
    };
  });

  const program = { name: parsedArgs.data.name, days };

  // Belt and braces: the assembled program must satisfy the same shape the app
  // parses it with. If this ever fails, the flat draft schema and the real
  // schema have drifted apart, and the app would reject the program on arrival.
  const validated = ProgramSchema.safeParse(program);
  return validated.success ? validated.data : null;
}

/** One-line summary ("5 days, 4 training days") sent back to the model. */
export function describeProgram(program: Program): string {
  const totalDays = program.days.length;
  const trainingDays = program.days.filter((day) => !day.isRestDay).length;

  return `${totalDays} days, ${trainingDays} training days`;
}
