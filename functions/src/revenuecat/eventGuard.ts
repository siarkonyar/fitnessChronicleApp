/**
 * Whether a webhook event has already been overtaken by a newer one.
 *
 * Deliberately knows nothing about Firestore, for the same reason period.ts
 * and bucket.ts don't: this is a billing-safety property, and one that should
 * be provable by tests running in milliseconds.
 *
 * WHY THIS EXISTS ALONGSIDE DEDUPLICATION, RATHER THAN INSTEAD OF IT
 *
 * They catch different failures and neither covers the other:
 *
 *   dedupe   — RevenueCat delivering the SAME event twice. Its id has been
 *              seen before, so the id is enough to recognise it.
 *   this     — a DIFFERENT, OLDER event arriving late. Its id has never been
 *              seen, so dedupe waves it straight through.
 *
 * The second is not hypothetical. RevenueCat retries a failed delivery five
 * times, at 5, 10, 20, 40 and 80 minutes, and documents no ordering guarantee
 * anywhere. A RENEWAL stuck behind those retries can land AFTER the
 * EXPIRATION that superseded it, and re-grant access that has already ended.
 */

/** What happened to an event the webhook handed us. */
export type ApplyOutcome =
  /** Written. The only outcome that changed anything. */
  | "applied"
  /** This exact event id has been processed before. */
  | "duplicate"
  /** A newer event has already been applied to this user. */
  | "stale";

/**
 * True when `eventAtMs` predates the newest event already applied.
 *
 * `lastEventAtMs` is undefined for a user no webhook has ever touched, which
 * is every user today — nothing can have overtaken a first event, so it is
 * never stale.
 *
 * EQUALITY IS NOT STALE, deliberately. Two distinct events can share a
 * millisecond, and a genuine replay is already stopped by the event id. A
 * `<=` here would therefore discard only real work and prevent no duplicate.
 *
 * Compares RevenueCat's `event_timestamp_ms` — when the event was GENERATED,
 * not when it was delivered and not when the underlying purchase happened.
 * Generation order is the only one of the three that reflects the order
 * RevenueCat decided things in.
 */
export const isStaleEvent = (
  eventAtMs: number,
  lastEventAtMs: number | undefined,
): boolean => lastEventAtMs !== undefined && eventAtMs < lastEventAtMs;
