import { describe, expect, it } from "vitest";
import type { Tier } from "../../src/quota/caps.js";
import {
  ENTITLEMENT_GRACE_HOURS,
  effectiveTier,
} from "../../src/quota/entitlement.js";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 2, 14, 12, 0, 0);
const GRACE = ENTITLEMENT_GRACE_HOURS * HOUR;

const PAID_TIERS = ["pro", "max"] as const satisfies readonly Tier[];

/**
 * Which tier a stored document actually entitles someone to RIGHT NOW.
 *
 * Separate from parseTier, which only asks "is this string a tier we know".
 * This asks the harder question: the document says pro, but the subscription
 * behind it ended three weeks ago and no webhook ever said so — what may this
 * person spend?
 *
 * Pure, with an injected clock, for the same reason period.ts is: it decides
 * how much money a user may cost us.
 */
describe("effectiveTier", () => {
  it("leaves a free document free", () => {
    expect(effectiveTier("free", undefined, NOW)).toBe("free");
  });

  it.each(PAID_TIERS)("honours a %s document inside its entitlement", (tier) => {
    expect(effectiveTier(tier, NOW + 10 * HOUR, NOW)).toBe(tier);
  });

  it.each(PAID_TIERS)(
    "keeps honouring a %s document just after expiry, inside the grace",
    (tier) => {
      // RevenueCat retries a failed delivery for about 2h35m. Downgrading the
      // moment an entitlement lapses would punish a paying customer for OUR
      // delivery problem, so the grace deliberately outlasts those retries.
      expect(effectiveTier(tier, NOW - HOUR, NOW)).toBe(tier);
    },
  );

  it.each(PAID_TIERS)(
    "drops a %s document to free once the grace has run out",
    (tier) => {
      // THE point of this function. Without it, a LOST expiry webhook — not a
      // late one, a lost one — leaves this user on a 3,000,000 token cap
      // forever, with a counter that never resets and a PRO badge that never
      // goes away.
      expect(effectiveTier(tier, NOW - GRACE - HOUR, NOW)).toBe("free");
    },
  );

  it("drops to free exactly when the grace runs out, not a moment later", () => {
    // Inclusive, matching the period boundary in period.ts: at the deadline
    // the grace is over, not ending.
    expect(effectiveTier("pro", NOW - GRACE, NOW)).toBe("free");
  });

  it("keeps honouring a paid document one millisecond before the deadline", () => {
    expect(effectiveTier("pro", NOW - GRACE + 1, NOW)).toBe("pro");
  });

  it.each(PAID_TIERS)(
    "refuses a %s document that has no entitlement date at all",
    (tier) => {
      // Corrupt state — applyEvent writes the tier and the entitlement in one
      // set, so one without the other should not exist. Failing closed means
      // a bad write can only ever cost allowance, never grant it.
      expect(effectiveTier(tier, undefined, NOW)).toBe("free");
    },
  );

  it("gives the grace a length that outlasts RevenueCat's retries", () => {
    // RevenueCat retries at 5, 10, 20, 40 and 80 minutes — about 2h35m in
    // total, after which the event is abandoned and never arrives at all.
    // Pinned so nobody shortens this below the window it exists to cover.
    const REVENUECAT_RETRY_WINDOW_HOURS = 2.6;

    expect(ENTITLEMENT_GRACE_HOURS).toBeGreaterThan(
      REVENUECAT_RETRY_WINDOW_HOURS,
    );
  });
});
