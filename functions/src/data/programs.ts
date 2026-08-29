import { logger } from "firebase-functions";
import { programsCollection } from "./firestore.js";
import { ProgramSchema, type Program } from "./schemas.js";

/**
 * The caller's saved program templates, newest first.
 *
 * Ported from getPrograms (lib/firebase/program.ts:38). `uid` is a parameter
 * because there is no currentUser on a server and the Admin SDK ignores
 * security rules.
 */
export const getPrograms = async (uid: string): Promise<Program[]> => {
  const snapshot = await programsCollection(uid)
    .orderBy("createdAt", "desc")
    .get();

  const programs: Program[] = [];

  for (const doc of snapshot.docs) {
    const parsed = ProgramSchema.safeParse(doc.data());

    if (!parsed.success) {
      logger.warn("Skipped unparseable program", {
        uid,
        docId: doc.id,
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      });
      continue;
    }

    programs.push(parsed.data);
  }

  return programs;
};
