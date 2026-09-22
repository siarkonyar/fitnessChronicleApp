/**
 * Which tier a stored document actually entitles someone to right now.
 *
 * Separate from parseTier, which only answers "is this string a tier we
 * recognise". This answers the harder question: the document says pro, but
 * the subscription behind it ended three weeks ago and no webhook ever said
 * so — what may this person spend?
 *
 * Pure, with an injected clock, for the same reason period.ts is. It decides
 * how much money a user is allowed to cost us.
 */
import type { Tier } from "./caps.js";

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * How long an expired paid entitlement is still honoured.
 *
 * WHAT THIS IS COVERING, precisely. RevenueCat retries a failed delivery five
 * times — at 5, 10, 20, 40 and 80 minutes — and then gives up. So the window
 * in which a webhook can still show up is about 2 hours 35 minutes, and this
 * grace only has to outlast that. It is NOT waiting for a store's billing
 * grace period: when a payment fails, RevenueCat keeps the entitlement alive
 * and pushes expiration_at_ms out to cover it, so entitlementExpiresAt has
 * already accounted for that before this function ever sees it.
 *
 * WHY IT IS NOT LONGER. Once RevenueCat abandons an event it is gone for
 * good, so a longer grace buys no extra chance of the truth arriving — it
 * only extends how long a lapsed subscriber keeps a paid cap. A day is
 * roughly nine times the retry window, absorbs an outage of ours comfortably,
 * and bounds the exposure at one day.
 *
 * WHY IT IS NOT ZERO. Downgrading the instant an entitlement lapses would
 * punish a paying customer for OUR delivery problem — the renewal may well
 * have been charged while the webhook telling us so was still being retried.
 */
export const ENTITLEMENT_GRACE_HOURS = 24;

const GRACE_MS = ENTITLEMENT_GRACE_HOURS * MS_PER_HOUR;

/**
 * Resolves the stored tier against the clock.
 *
 * THE GAP THIS CLOSES. period.ts deliberately refuses to renew OR downgrade
 * an expired paid period, and waits for RevenueCat to settle the question.
 * That is right for a LATE webhook and wrong for a LOST one: with no bound on
 * the wait, a user whose EXPIRATION never arrived keeps a 3,000,000 token
 * cap forever, keeps a counter that never resets, and keeps a PRO badge.
 * This bounds the wait, and the direction it fails in is the safe one.
 *
 * DELIBERATELY NOT A SEPARATE DOWNGRADE PATH. Once this returns "free", the
 * caller's existing free-tier logic takes over by itself: period.ts opens a
 * fresh 30-day period, the counter zeroes, the cap becomes FREE_TOKEN_CAP and
 * resetsAt stops reporting a date in the past. No new branch anywhere.
 *
 * A LATE WEBHOOK STILL RECOVERS THE USER. Downgrading here changes no
 * subscription state — it only stops honouring one — so an event arriving
 * afterwards writes the tier and the entitlement back and the user is paid
 * again immediately. The record of what happened lives in rcEvents.
 */
export const effectiveTier = (
  storedTier: Tier,
  entitlementExpiresAtMs: number | undefined,
  nowMs: number,
): Tier => {
  if (storedTier === "free") return "free";

  // A paid tier with no entitlement date is corrupt: applyEvent writes the
  // two together in a single set, so one cannot exist without the other.
  // Failing closed means a bad write can only cost allowance, never grant it.
  if (entitlementExpiresAtMs === undefined) return "free";

  // Inclusive at the deadline, matching the period boundary in period.ts: at
  // the deadline the grace is over, not ending.
  const graceEndsAtMs = entitlementExpiresAtMs + GRACE_MS;

  return nowMs < graceEndsAtMs ? storedTier : "free";
};
