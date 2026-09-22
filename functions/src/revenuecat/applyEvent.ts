import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { aiUsageDoc, db, rcEventDoc } from "../data/firestore.js";
import { isStaleEvent, type ApplyOutcome } from "./eventGuard.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long a processed-event record is kept.
 *
 * Only has to outlive RevenueCat's retry schedule, which ends 2 hours and 35
 * minutes after the first attempt. Thirty days is absurdly more than that and
 * leaves a month of history for answering "why did this user's tier change",
 * while keeping the collection from growing without bound.
 */
const RC_EVENT_TTL_DAYS = 30;

/** The fields of a RevenueCat event this module needs. */
export interface RevenueCatEventRef {
  /** RevenueCat's `event.id`. Becomes the rcEvents document id. */
  eventId: string;
  /** RevenueCat's `event.type`, e.g. "RENEWAL". Stored for debugging only. */
  type: string;
  /**
   * The Firebase uid. NOT taken from the payload unchecked — the caller is
   * responsible for having verified that RevenueCat's `app_user_id` really is
   * a Firebase uid, because an anonymous purchase carries a
   * "$RCAnonymousID:…" instead and would create an orphan document here.
   */
  uid: string;
  /** RevenueCat's `event_timestamp_ms`: when the event was GENERATED. */
  eventAtMs: number;
}

/**
 * Computes the aiUsage fields this event should merge in.
 *
 * MUST BE PURE. A Firestore transaction re-runs its callback on contention,
 * so this can be invoked several times for one logical apply. Given the
 * current document it returns the fields to write, and does no writing and no
 * I/O of its own.
 *
 * Receives `undefined` when the user has no usage document yet.
 */
export type EventMutation = (current: DocumentData | undefined) => DocumentData;

/**
 * Applies one RevenueCat webhook event, exactly once and in order.
 *
 * Both guards and the write live in ONE transaction, and that is the whole
 * point of this function existing rather than the webhook doing it inline:
 *
 *   - Checked OUTSIDE a transaction, two concurrent deliveries of the same
 *     event would both find no record and both apply. A redelivered RENEWAL
 *     applied twice zeroes tokensUsed twice, which is a second free allowance
 *     — the very thing period.ts refuses to hand out on a timer, arriving
 *     instead through the front door.
 *   - Checked in a DIFFERENT transaction from the write, a crash in between
 *     leaves an event marked processed that never took effect, and the retry
 *     is then discarded as a duplicate.
 *
 * Returns what happened. "duplicate" and "stale" are ordinary, expected
 * outcomes rather than errors: the caller should log them and still answer
 * 2xx, because RevenueCat responds to anything else by retrying — which
 * produces more of exactly the duplicates this is refusing.
 */
export const applyRevenueCatEvent = async (
  event: RevenueCatEventRef,
  mutate: EventMutation,
): Promise<ApplyOutcome> => {
  const eventRef = rcEventDoc(event.eventId);
  const usageRef = aiUsageDoc(event.uid);

  return db.runTransaction<ApplyOutcome>(async (tx) => {
    // Firestore requires every read in a transaction to precede every write,
    // so both are fetched up front rather than read as they are needed.
    const [eventSnapshot, usageSnapshot] = await Promise.all([
      tx.get(eventRef),
      tx.get(usageRef),
    ]);

    // GUARD 1 — the same event, delivered again.
    if (eventSnapshot.exists) return "duplicate";

    const usage = usageSnapshot.data();
    const lastEventAtMs =
      typeof usage?.lastEventAtMs === "number" ? usage.lastEventAtMs : undefined;

    // GUARD 2 — a different, older event, delivered late.
    if (isStaleEvent(event.eventAtMs, lastEventAtMs)) return "stale";

    // One write, not two. The high-water mark is merged into the caller's own
    // fields rather than set separately, so there is no arrangement of these
    // statements in which a change lands without the mark that orders it.
    tx.set(
      usageRef,
      { ...mutate(usage), lastEventAtMs: event.eventAtMs },
      { merge: true },
    );

    // create(), not set(): belt and braces behind the guard above. If the
    // read were ever wrong, this throws rather than silently reprocessing.
    tx.create(eventRef, {
      type: event.type,
      uid: event.uid,
      eventAtMs: event.eventAtMs,
      processedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(
        Date.now() + RC_EVENT_TTL_DAYS * MS_PER_DAY,
      ),
    });

    return "applied";
  });
};
