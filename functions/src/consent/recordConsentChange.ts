import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/firestore";
import { consentEventsCollection } from "../data/firestore.js";

/**
 * Every consent this trigger watches on users/{uid}.
 *
 * A list rather than one hardcoded field, because analytics is unlikely to
 * stay the only consent — marketing mail or crash reporting could be a second.
 * `setting` is the discriminator written into each log row; it has to be
 * assigned here, once, because the log is append-only and a discriminator
 * cannot be backfilled onto rows that already exist.
 *
 * Rows with setting "ai_coach" exist in the log from the period when the AI
 * coach had its own opt-in. They are deliberately left in place: the log is
 * append-only, and deleting the evidence of a consent that was genuinely given
 * would defeat the only purpose it has.
 */
const WATCHED_CONSENT_FIELDS: readonly { field: string; setting: string }[] = [
  { field: "analyticsConsent", setting: "analytics" },
];

const readConsent = (
  data: FirebaseFirestore.DocumentData | undefined,
  field: string,
): boolean | null => {
  const value = data?.[field];
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
 * first thing it does per field is compare before and after and skip: the
 * common case costs a handful of comparisons and no write at all.
 */
export const onConsentChanged = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { uid } = event.params;

    for (const { field, setting } of WATCHED_CONSENT_FIELDS) {
      const previous = readConsent(before, field);
      const granted = readConsent(after, field);

      // The overwhelmingly common path: this particular field did not change.
      if (previous === granted) continue;

      // The document was deleted, or the field was cleared. Account deletion
      // lands here, and it must NOT append a "consent withdrawn" row — the user
      // withdrew their account, which is not the same statement, and recording
      // it as one would misrepresent them in the only record that outlives them.
      if (granted === null) continue;

      try {
        await consentEventsCollection().add({
          uid,
          setting,
          granted,
          // null on the first ever choice, which is worth telling apart from a
          // deliberate change of mind.
          previous,
          at: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        // Logged, never swallowed and never rethrown. Rethrowing would make the
        // runtime retry the whole trigger, and a retry that succeeds after a
        // partial failure would append the same consent change twice for every
        // field, not just the one that failed — a log that double-counts is
        // worse than one that is short a row and says so.
        logger.error("Failed to record consent change", {
          uid,
          setting,
          granted,
          error,
        });
      }
    }
  },
);
