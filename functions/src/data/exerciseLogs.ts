import { logger } from "firebase-functions";
import { fitnessLogsCollection } from "./firestore.js";
import { ExerciseLogSchema, type ExerciseLog } from "./schemas.js";

/** Hard cap on logs read in one call, so a wide range cannot blow the context window. */
export const MAX_LOGS_RETURNED = 200;

export interface ExerciseLogPage {
  logs: ExerciseLog[];
  /** True when the range held more logs than we returned. */
  truncated: boolean;
}

/**
 * The caller's logged workouts between two dates, inclusive.
 *
 * Ported from getExerciseLogsByDateRange (lib/firebase/exercise.ts:93), with two
 * deliberate differences.
 *
 * 1. `uid` is a parameter. There is no currentUser on a server, and the Admin
 *    SDK ignores security rules — this uid must come from verified auth.
 *
 * 2. Ordered by date DESCENDING before the limit. The client's date-range filter
 *    imposes an implicit ascending order, so its .limit(200) keeps the OLDEST
 *    200 in the range — ask about a whole year and you get last January rather
 *    than last week. coachTools.ts:188 tries to correct for that with
 *    slice(-200), but that is a no-op once the query itself has capped the
 *    result. We take the most recent 200 and reverse, so callers still get
 *    date-ascending output.
 *
 * `uniqueDates` from the original is not returned: only the calendar screens use
 * it, and the coach never does.
 */
export const getExerciseLogsByDateRange = async (
  uid: string,
  startDate: string,
  endDate: string
): Promise<ExerciseLogPage> => {
  const snapshot = await fitnessLogsCollection(uid)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .orderBy("date", "desc")
    // One extra row is a cheap way to know whether more existed.
    .limit(MAX_LOGS_RETURNED + 1)
    .get();

  const truncated = snapshot.docs.length > MAX_LOGS_RETURNED;
  const wanted = snapshot.docs.slice(0, MAX_LOGS_RETURNED);

  const logs: ExerciseLog[] = [];

  for (const doc of wanted) {
    const parsed = ExerciseLogSchema.safeParse(doc.data());

    if (!parsed.success) {
      // Skip rather than throw. The client parses strictly, but there one bad
      // row breaks one screen; here it would break the whole conversation. The
      // user still gets an answer, and we keep a record of what was dropped.
      logger.warn("Skipped unparseable fitnessLog", {
        uid,
        docId: doc.id,
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      });
      continue;
    }

    logs.push(parsed.data);
  }

  // Back to ascending, which is the order the formatter and the model expect.
  return { logs: logs.reverse(), truncated };
};
