import { describe, expect, it } from "vitest";
import { isStaleEvent } from "../../src/revenuecat/eventGuard.js";

const NOON = Date.UTC(2026, 2, 14, 12, 0, 0);
const MINUTE = 60 * 1000;

/**
 * Whether a webhook event has been overtaken by a newer one.
 *
 * Pure, for the same reason period.ts and bucket.ts are: this is the half of
 * webhook safety that deduplication CANNOT cover, and a rule that important
 * should be provable without an emulator.
 *
 * Deduplication catches RevenueCat delivering the SAME event twice. It does
 * nothing about a DIFFERENT, older event arriving late — that event has an id
 * nobody has seen, so dedupe waves it straight through. RevenueCat documents
 * no ordering guarantee at all, so a RENEWAL delayed behind an EXPIRATION can
 * land second and re-grant access that has already ended.
 */
describe("isStaleEvent", () => {
  it("accepts the very first event for a user", () => {
    // No high-water mark yet. Nothing can have overtaken this.
    expect(isStaleEvent(NOON, undefined)).toBe(false);
  });

  it("rejects an event generated before the newest one already applied", () => {
    // The whole point: a late delivery must not undo a newer decision.
    expect(isStaleEvent(NOON - MINUTE, NOON)).toBe(true);
  });

  it("accepts an event generated after the newest one already applied", () => {
    expect(isStaleEvent(NOON + MINUTE, NOON)).toBe(false);
  });

  it("accepts an event sharing a timestamp with the newest one applied", () => {
    // Deliberately NOT stale at equality. Two distinct events can share a
    // millisecond, and a true replay is already stopped by the event id —
    // so rejecting here would only ever discard real work.
    expect(isStaleEvent(NOON, NOON)).toBe(false);
  });

  it("rejects an event from long before the newest one applied", () => {
    const anHourEarlier = NOON - 60 * MINUTE;

    // RevenueCat retries at 5, 10, 20, 40 and 80 minutes, so a delivery
    // arriving well over an hour late is ordinary, not exotic.
    expect(isStaleEvent(anHourEarlier, NOON)).toBe(true);
  });
});
