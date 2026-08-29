import { FieldValue } from "firebase-admin/firestore";
import { aiUsageDoc } from "../data/firestore.js";

/**
 * Adds this turn's token cost onto the caller's running total.
 *
 * Called after the flow succeeds, never before — recording a turn that failed
 * would charge a user for a reply they never got.
 *
 * FieldValue.increment is an atomic add performed by Firestore itself, not a
 * read-modify-write done here. That matters under concurrency: two turns
 * finishing at the same moment both increment correctly, where a
 * read-then-set with plain numbers would let the second write clobber the
 * first and lose tokens off the count.
 *
 * The document is assumed to already exist — checkQuota always runs first in
 * the callable and creates it on a user's very first turn.
 */
export const recordUsage = async (
  uid: string,
  totalTokens: number
): Promise<void> => {
  if (totalTokens <= 0) return;

  await aiUsageDoc(uid).update({
    tokensUsed: FieldValue.increment(totalTokens),
  });
};
