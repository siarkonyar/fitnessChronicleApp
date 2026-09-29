import { beforeEach, describe, expect, it } from "vitest";
import { syncCustomer } from "../../src/revenuecat/syncCustomer.js";
import {
  clearCustomers,
  clearUsage,
  createTestUser,
  readUsage,
  seedCustomer,
  seedUsage,
  waitFor,
  waitForUsageToExist,
} from "./setup.js";

/**
 * The RevenueCat extension writes revenuecatCustomers/{uid}; the trigger
 * copies the plan onto aiUsage/{uid}.
 *
 * Mostly OVER THE WIRE: each test writes a customer document with the Admin
 * SDK, which fires the real trigger in the functions emulator, then waits for
 * aiUsage to change. That proves the path, the region and the export, not
 * just the logic. The cases that must change NOTHING call syncCustomer
 * directly instead, because "nothing happened yet" and "nothing will happen"
 * look the same from outside.
 */

const DAY = 24 * 60 * 60 * 1000;
const MONTHLY_PRO = "hercule_pro_monthly";

const iso = (ms: number): string => new Date(ms).toISOString();

interface ProCustomer {
  purchasedAtMs: number;
  expiresAtMs: number;
  graceEndsAtMs?: number;
  isSandbox?: boolean;
}

/** A customer document as the extension writes it, holding one pro plan. */
const proCustomer = ({
  purchasedAtMs,
  expiresAtMs,
  graceEndsAtMs,
  isSandbox = false,
}: ProCustomer) => ({
  entitlements: {
    pro: {
      product_identifier: MONTHLY_PRO,
      purchase_date: iso(purchasedAtMs),
      expires_date: iso(expiresAtMs),
      grace_period_expires_date:
        graceEndsAtMs === undefined ? null : iso(graceEndsAtMs),
    },
  },
  subscriptions: {
    [MONTHLY_PRO]: { is_sandbox: isSandbox, store: "app_store" },
  },
  // Present on every real document, ignored by the schema.
  aliases: [],
});

/** A signed-up user whose onUserCreated document already exists. */
const freshUser = async (): Promise<string> => {
  const { uid } = await createTestUser();
  expect(await waitForUsageToExist(uid)).toBe(true);
  return uid;
};

const usageMatches = (
  uid: string,
  check: (usage: FirebaseFirestore.DocumentData) => boolean,
): Promise<boolean> =>
  waitFor(async () => {
    const usage = await readUsage(uid);
    return usage !== undefined && check(usage);
  });

describe("onRevenueCatCustomerWritten", () => {
  beforeEach(async () => {
    await clearCustomers();
    await clearUsage();
  });

  it("gives a first purchase the paid tier and a fresh allowance", async () => {
    const uid = await freshUser();
    await seedUsage(uid, { tokensUsed: 30_000 });
    const expiresAtMs = Date.now() + 30 * DAY;

    await seedCustomer(uid, proCustomer({ purchasedAtMs: Date.now(), expiresAtMs }));

    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);
    const usage = await readUsage(uid);
    expect(usage?.tokensUsed).toBe(0);
    expect(usage?.entitlementExpiresAt.toMillis()).toBe(expiresAtMs);
    // Monthly: the period ends with the plan, and the renewal resets it.
    expect(usage?.periodEnd.toMillis()).toBe(expiresAtMs);
    // For support: what granted the plan, and when we last wrote it.
    expect(usage).toMatchObject({
      productId: MONTHLY_PRO,
      store: "app_store",
      isSandbox: false,
    });
    expect(usage?.syncedAt).toBeDefined();
  });

  it("resets the counter again when the plan renews", async () => {
    const uid = await freshUser();
    const firstPaidAt = Date.now() - 29 * DAY;
    await seedCustomer(
      uid,
      proCustomer({ purchasedAtMs: firstPaidAt, expiresAtMs: Date.now() + DAY }),
    );
    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);
    await seedUsage(uid, { tokensUsed: 5_000 });

    await seedCustomer(
      uid,
      proCustomer({ purchasedAtMs: Date.now(), expiresAtMs: Date.now() + 31 * DAY }),
    );

    expect(await usageMatches(uid, (usage) => usage.tokensUsed === 0)).toBe(true);
  });

  it("keeps the counter when billing grace pushes the expiry out", async () => {
    // The card failed and the store is retrying it. Nobody paid, so a reset
    // here would be a free allowance handed out by a declined card.
    const uid = await freshUser();
    const paidAt = Date.now() - 30 * DAY;
    await seedCustomer(
      uid,
      proCustomer({ purchasedAtMs: paidAt, expiresAtMs: Date.now() + DAY }),
    );
    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);
    await seedUsage(uid, { tokensUsed: 5_000 });
    const graceEndsAtMs = Date.now() + 16 * DAY;

    await seedCustomer(
      uid,
      proCustomer({
        purchasedAtMs: paidAt,
        expiresAtMs: Date.now() - DAY,
        graceEndsAtMs,
      }),
    );

    expect(
      await usageMatches(
        uid,
        (usage) => usage.entitlementExpiresAt?.toMillis() === graceEndsAtMs,
      ),
    ).toBe(true);
    expect((await readUsage(uid))?.tokensUsed).toBe(5_000);
  });

  it("does not reset the counter when the same state is applied twice", async () => {
    // Firestore triggers are at-least-once. A redelivery is a second call
    // with nothing new in it.
    const uid = await freshUser();
    await seedCustomer(
      uid,
      proCustomer({ purchasedAtMs: Date.now(), expiresAtMs: Date.now() + 30 * DAY }),
    );
    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);
    await seedUsage(uid, { tokensUsed: 5_000 });

    await syncCustomer(uid);

    expect((await readUsage(uid))?.tokensUsed).toBe(5_000);
  });

  it("downgrades a paid user whose plan has ended", async () => {
    const uid = await freshUser();
    await seedCustomer(
      uid,
      proCustomer({ purchasedAtMs: Date.now(), expiresAtMs: Date.now() + 30 * DAY }),
    );
    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);

    await seedCustomer(
      uid,
      proCustomer({
        purchasedAtMs: Date.now() - 31 * DAY,
        expiresAtMs: Date.now() - DAY,
      }),
    );

    expect(await usageMatches(uid, (usage) => usage.tier === "free")).toBe(true);
    const usage = await readUsage(uid);
    expect(usage?.entitlementExpiresAt).toBeUndefined();
    // No stale product left behind to mislead whoever reads it next.
    expect(usage?.productId).toBeUndefined();
    expect(usage?.store).toBeUndefined();
    expect(usage?.isSandbox).toBeUndefined();
  });

  it("accepts a sandbox purchase", async () => {
    // Decided 2026-09-28: App Review buys with sandbox accounts, so ignoring
    // sandbox would get the app rejected. Test subscriptions expire quickly.
    const uid = await freshUser();

    await seedCustomer(
      uid,
      proCustomer({
        purchasedAtMs: Date.now(),
        expiresAtMs: Date.now() + DAY,
        isSandbox: true,
      }),
    );

    expect(await usageMatches(uid, (usage) => usage.tier === "pro")).toBe(true);
  });

  describe("documents it must not act on", () => {
    it("ignores an anonymous RevenueCat id", async () => {
      // A purchase made before Purchases.logIn(uid). No Firebase account to
      // pay for, and writing aiUsage/$RCAnonymousID:… would be an orphan.
      const anonymousId = "$RCAnonymousID:0123456789abcdef";
      await seedCustomer(
        anonymousId,
        proCustomer({ purchasedAtMs: Date.now(), expiresAtMs: Date.now() + DAY }),
      );

      expect(await syncCustomer(anonymousId)).toBe("not_a_user");
      expect(await readUsage(anonymousId)).toBeUndefined();
    });

    it("ignores an id with no Firebase account behind it", async () => {
      // A deleted account, or a uid that never existed. Writing its aiUsage
      // would resurrect the counter onUserDeleted just removed.
      const uid = "no-such-firebase-user";
      await seedCustomer(
        uid,
        proCustomer({ purchasedAtMs: Date.now(), expiresAtMs: Date.now() + DAY }),
      );

      expect(await syncCustomer(uid)).toBe("not_a_user");
      expect(await readUsage(uid)).toBeUndefined();
    });

    it("leaves aiUsage alone when the customer document is malformed", async () => {
      const uid = await freshUser();
      await seedCustomer(uid, { entitlements: "not an object" });

      expect(await syncCustomer(uid)).toBe("invalid");
      expect((await readUsage(uid))?.tier).toBe("free");
    });

    it("does nothing when there is no customer document", async () => {
      const uid = await freshUser();

      expect(await syncCustomer(uid)).toBe("no_customer");
      expect((await readUsage(uid))?.tier).toBe("free");
    });
  });
});
