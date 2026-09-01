import { logger } from "firebase-functions";
import { region } from "firebase-functions/v1";
import { aiUsageDoc } from "../data/firestore.js";

/**
 * Spelled out rather than imported from index.ts.
 *
 * index.ts re-exports this trigger, so importing REGION back out of it would be
 * a cycle. recordConsentChange.ts hardcodes the same string for the same reason.
 */
const TRIGGER_REGION = "europe-west2";

/**
 * Deletes the user's AI usage counter once their account is gone.
 *
 * WHY THIS IS A TRIGGER AND NOT A STEP INSIDE deleteAccount()
 *
 * aiUsage/{uid} is deliberately top-level (data/firestore.ts:44) and the
 * catch-all deny at firestore.rules:26-28 puts it out of every client's reach.
 * That is the property stopping a user from editing their own quota, and it is
 * also why the app cannot clean the document up itself: only the Admin SDK can
 * touch it, so the delete has to happen server-side.
 *
 * A callable would not work either. deleteAccount() deletes the auth account as
 * its last step, and from that moment the client holds no valid ID token —
 * there is no authenticated call left to make. Anything invoked before that
 * point would run while the account still existed, which is exactly the
 * ordering this function exists to avoid.
 *
 * WHY auth.onDelete AND NOT onDocumentDeleted("users/{uid}")
 *
 * A Firestore trigger on the user document would fire in the MIDDLE of
 * deleteAccount(), before deleteUser(). Should the auth deletion then fail, the
 * user would keep their account and lose their usage counter — a free allowance
 * reset handed out by a half-finished deletion. This fires only once the auth
 * account is actually gone, so it can never run for an account that still
 * exists. It also covers deletions made from the Firebase console or by the
 * Admin SDK, which never go through the app at all.
 *
 * ORDERING. This is the last thing to happen in an account deletion, and it is
 * the client's call order that makes that true: lib/firebase/account.ts deletes
 * every subcollection and the user document BEFORE calling deleteUser, and
 * deleteUser is what fires this. Moving deleteUser earlier in that function
 * would silently break the guarantee.
 */
export const onUserDeleted = region(TRIGGER_REGION)
  .runWith({ failurePolicy: true })
  .auth.user()
  .onDelete(async (user) => {
    const { uid } = user;

    try {
      await aiUsageDoc(uid).delete();
      logger.info("Deleted aiUsage after account deletion", { uid });
    } catch (error) {
      logger.error("Failed to delete aiUsage after account deletion", {
        uid,
        error,
      });

      // Rethrown so the runtime retries — the OPPOSITE of what onConsentChanged
      // does, and deliberately so. A retried append writes a duplicate consent
      // row, which is why that trigger swallows its error. A retried delete
      // writes nothing twice: deleting an already-deleted document succeeds
      // silently. The failure mode here is a usage counter outliving the account
      // it belonged to, so retrying until it is gone is strictly better than
      // giving up after one attempt.
      throw error;
    }
  });
