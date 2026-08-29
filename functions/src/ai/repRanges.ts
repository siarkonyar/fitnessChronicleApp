/**
 * Ported verbatim from constants/RepRanges.ts.
 *
 * The rep-range buckets the wheel picker offers when the user prefers ranges
 * over exact reps. This is a closed vocabulary, not a format: a value that is
 * not in this list has nothing for the picker to land on, so if the app's list
 * changes this copy must change with it.
 *
 * Order matters — toReps scans it top to bottom and takes the first bucket that
 * contains the number, which is how overlaps like 10 ("9-10" vs "10-12") resolve.
 */
export const REP_RANGE_OPTIONS = [
  "1",
  "2",
  "3-4",
  "5-6",
  "7-8",
  "9-10",
  "10-12",
  "12-15",
  "15-20",
  "20+",
] as const;

/**
 * The numeric bounds a bucket covers: "3-4" → 3..4, "20+" → 20..Infinity,
 * "1" → 1..1.
 */
export function bucketBounds(option: string): { min: number; max: number } {
  if (option.endsWith("+")) {
    return { min: Number(option.slice(0, -1)), max: Infinity };
  }

  const parts = option.split("-");
  return { min: Number(parts[0]), max: Number(parts[parts.length - 1]) };
}
