import { logger } from "firebase-functions";
import { labelsCollection } from "./firestore.js";
import { LabelSchema, type Label } from "./schemas.js";

/**
 * The caller's workout day labels, newest first.
 *
 * Ported from getAllLabels (lib/firebase/label.ts:60). `uid` is a parameter
 * because there is no currentUser on a server and the Admin SDK ignores
 * security rules.
 */
export const getAllLabels = async (uid: string): Promise<Label[]> => {
  const snapshot = await labelsCollection(uid).orderBy("createdAt", "desc").get();

  const labels: Label[] = [];

  for (const doc of snapshot.docs) {
    const parsed = LabelSchema.safeParse(doc.data());

    if (!parsed.success) {
      logger.warn("Skipped unparseable label", {
        uid,
        docId: doc.id,
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      });
      continue;
    }

    labels.push(parsed.data);
  }

  return labels;
};
