/**
 * The rep-range buckets the wheel picker offers when the user prefers ranges
 * over exact reps. This is a closed vocabulary, not a format: a value that is
 * not in this list has nothing for the picker to land on.
 *
 * Order matters — `toReps` (functions/src/ai/programDraft.ts) scans it top to
 * bottom and takes the first bucket that contains the number, which is how
 * overlaps like 10 ("9-10" vs "10-12") resolve. That copy is the one the coach
 * uses; keep the two lists identical or a proposed program lands on a bucket
 * the picker cannot show.
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