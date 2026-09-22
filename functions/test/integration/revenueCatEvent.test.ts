import { randomUUID } from "node:crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { applyRevenueCatEvent } from "../../src/revenuecat/applyEvent.js";
import {
  clearRcEvents,
  clearUsage,
  readRcEvent,
  readUsage,
  seedUsage,
} from "./setup.js";

/**
 * Exactly-once, in-order application of RevenueCat webhook events.
 *
 * DELIBERATELY NOT OVER THE WIRE, unlike every other suite here. There is no
 * callable to invoke — the thing under test IS the Firestore transaction, and
 * the failures worth catching (two concurrent deliveries both applying, a
 * guard checked outside the transaction that guards nothing) only exist
 * against a real Firestore. The emulator is the point; the network is not.
 *
 * Nothing calls this in production yet. The webhook does not exist, so every
 * event below is constructed by hand.
 */

const MINUTE = 60 * 1000;

/** No auth user needed: this module only ever touches aiUsage/{uid}. */
const freshUid = () => `rc-test-${randomUUID()}`;
const freshEventId = () => `evt_${randomUUID()}`;

/**
 * Counts how many times an apply actually committed.
 *
 * FieldValue.increment is safe despite the transaction possibly re-running
 * its callback: a retried transaction discards its earlier write, so the
 * increment lands exactly once per COMMIT rather than once per attempt.
 */
const countApplies = (): DocumentData => ({
  applyCount: FieldValue.increment(1),
});

describe("applyRevenueCatEvent", () => {
  beforeEach(async () => {
    await clearUsage();
    await clearRcEvents();
  });

  it("applies a first event and records it", async () => {
    const uid = freshUid();
    const eventId = freshEventId();
    const eventAtMs = Date.now();

    const outcome = await applyRevenueCatEvent(
      { eventId, type: "INITIAL_PURCHASE", uid, eventAtMs },
      () => ({ tier: "pro" }),
    );

    expect(outcome).toBe("applied");

    // The caller's fields landed...
    const usage = await readUsage(uid);
    expect(usage?.tier).toBe("pro");
    // ...and so did the high-water mark that orders the next one.
    expect(usage?.lastEventAtMs).toBe(eventAtMs);

    // And the event is on record, so a redelivery can recognise it.
    const record = await readRcEvent(eventId);
    expect(record).toMatchObject({ type: "INITIAL_PURCHASE", uid, eventAtMs });
    // TTL field for the Firestore policy. Writing it does not enable the
    // policy — that is configured on the collection — but its absence would
    // mean the collection could never be cleaned up at all.
    expect(record?.expireAt).toBeDefined();
    expect(record?.processedAt).toBeDefined();
  });

  it("ignores the same event delivered twice", async () => {
    // RevenueCat retries five times and warns the same event may arrive more
    // than once. Applied twice, a RENEWAL zeroes tokensUsed twice — a second
    // free allowance, which is what period.ts refuses to hand out on a timer.
    const uid = freshUid();
    const eventId = freshEventId();
    const event = { eventId, type: "RENEWAL", uid, eventAtMs: Date.now() };

    expect(await applyRevenueCatEvent(event, countApplies)).toBe("applied");
    expect(await applyRevenueCatEvent(event, countApplies)).toBe("duplicate");

    expect((await readUsage(uid))?.applyCount).toBe(1);
  });

  it("ignores an event older than the newest one already applied", async () => {
    // The failure dedupe CANNOT catch: this event's id has never been seen,
    // so only the timestamp distinguishes it.
    const uid = freshUid();
    const newest = Date.now();

    await applyRevenueCatEvent(
      { eventId: freshEventId(), type: "EXPIRATION", uid, eventAtMs: newest },
      () => ({ tier: "free" }),
    );

    const outcome = await applyRevenueCatEvent(
      {
        eventId: freshEventId(),
        type: "RENEWAL",
        uid,
        eventAtMs: newest - 30 * MINUTE,
      },
      () => ({ tier: "pro" }),
    );

    expect(outcome).toBe("stale");
    // The late RENEWAL must NOT have re-granted access the EXPIRATION ended.
    expect((await readUsage(uid))?.tier).toBe("free");
  });

  it("applies an event newer than the one already applied", async () => {
    const uid = freshUid();
    const first = Date.now();

    await applyRevenueCatEvent(
      { eventId: freshEventId(), type: "EXPIRATION", uid, eventAtMs: first },
      () => ({ tier: "free" }),
    );

    const outcome = await applyRevenueCatEvent(
      {
        eventId: freshEventId(),
        type: "RENEWAL",
        uid,
        eventAtMs: first + MINUTE,
      },
      () => ({ tier: "pro" }),
    );

    // A genuine resubscribe after an expiry. The RENEWAL branch has to GRANT,
    // not merely extend, or the returning customer stays locked out.
    expect(outcome).toBe("applied");
    expect((await readUsage(uid))?.tier).toBe("pro");
  });

  it("applies only once when the same event arrives concurrently", async () => {
    // THE reason both guards live inside one transaction. Checked outside,
    // both deliveries read "not processed", both pass, and both apply.
    const uid = freshUid();
    const event = {
      eventId: freshEventId(),
      type: "RENEWAL",
      uid,
      eventAtMs: Date.now(),
    };

    const outcomes = await Promise.all([
      applyRevenueCatEvent(event, countApplies),
      applyRevenueCatEvent(event, countApplies),
    ]);

    expect([...outcomes].sort()).toEqual(["applied", "duplicate"]);
    expect((await readUsage(uid))?.applyCount).toBe(1);
  });

  it("sees an existing usage document when computing its fields", async () => {
    // The mutation is handed the CURRENT document, so a webhook can decide
    // based on what is already there — e.g. whether to zero a counter.
    const uid = freshUid();
    await seedUsage(uid, { tier: "free", tokensUsed: 25_000 });

    await applyRevenueCatEvent(
      {
        eventId: freshEventId(),
        type: "INITIAL_PURCHASE",
        uid,
        eventAtMs: Date.now(),
      },
      (current) => ({
        tier: "pro",
        // An upgrade forgives whatever the free tier was owed.
        tokensUsed: 0,
        previousTokensUsed: current?.tokensUsed ?? null,
      }),
    );

    const usage = await readUsage(uid);
    expect(usage?.previousTokensUsed).toBe(25_000);
    expect(usage?.tokensUsed).toBe(0);
  });
});
