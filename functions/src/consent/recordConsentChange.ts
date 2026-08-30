import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/firestore";
import { consentEventsCollection } from "../data/firestore.js";

/**
 * Which consent this log entry is about.
 *
 * A constant rather than an inline string because analytics will not be the
 * only consent forever — marketing mail and crash reporting are the obvious
 * next ones — and the log needs to say which one changed from its very first
 * row. Backfilling a discriminator onto an append-only collection is not
 * possible: by definition, nothing in it can be rewritten.
 */
const ANALYTICS_SETTING = "analytics";

/** The field on users/{uid} that this trigger watches. */
const CONSENT_FIELD = "analyticsConsent";

const readConsent = (
  data: FirebaseFirestore.DocumentData | undefined,
): boolean | null => {
  const value = data?.[CONSENT_FIELD];
  return typeof value === "boolean" ? value : null;
};

/**
 * Writes the tamper-proof record of a consent change.
 *
 * Why a trigger and not a callable: a callable would be lost whenever the user
 * flips the toggle offline, and this app has an entire offline mode. A Firestore
 * write is queued locally by the SDK and delivered when the network returns, so
 * routing the record through a document write is what makes it survive the one
 * case where it would otherwise silently go missing.
 *
 * The timestamp is written by the server, never taken from the request. A device
 * clock is attacker-controlled and trivially wrong even when it is not; evidence
 * dated by the thing being disputed is not evidence.
 *
 * This fires on every write to users/{uid}, including the frequent ones that
 * have nothing to do with consent (measure, activeProgramDay). That is why the
 * first thing it does is compare before and after and return: the common case
 * costs one comparison and no write at all.
 */
export const onConsentChanged = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west2" },
  async (event) => {
    const previous = readConsent(event.data?.before.data());
    const granted = readConsent(event.data?.after.data());

    // The overwhelmingly common path: some other field changed.
    if (previous === granted) return;

    // The document was deleted, or the field was cleared. Account deletion
    // lands here, and it must NOT append a "consent withdrawn" row — the user
    // withdrew their account, which is not the same statement, and recording it
    // as one would misrepresent them in the only record that outlives them.
    if (granted === null) return;

    const { uid } = event.params;

    try {
      await consentEventsCollection().add({
        uid,
        setting: ANALYTICS_SETTING,
        granted,
        // null on the first ever choice, which is worth telling apart from a
        // deliberate change of mind.
        previous,
        at: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Logged, never swallowed and never rethrown. Rethrowing would make the
      // runtime retry the whole trigger, and a retry that succeeds after a
      // partial failure would append the same consent change twice — a log
      // that double-counts is worse than one that is short a row and says so.
      logger.error("Failed to record consent change", { uid, granted, error });
    }
  },
);
