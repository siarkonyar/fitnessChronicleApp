import { describe, expect, it } from "vitest";
import {
  adminDb,
  clearCustomers,
  clearUsage,
  createTestUser,
  deleteAuthUser,
  readUsage,
  seedCustomer,
  seedUsage,
  waitFor,
  waitForUsageToExist,
} from "./setup.js";

/**
 * How long to give the trigger before calling it a failure.
 *
 * onUserDeleted is a background function: deleteUser resolves as soon as the
 * auth record is gone, and the trigger runs afterwards on its own schedule.
 * Polling rather than one fixed sleep because the first invocation pays a cold
 * start the later ones do not — a sleep long enough for that would be dead time
 * in every run after it.
 */
const TRIGGER_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 250;

const waitForUsageToBeDeleted = async (uid: string): Promise<boolean> => {
  const deadline = Date.now() + TRIGGER_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if ((await readUsage(uid)) === undefined) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
};


/**
 * The last step of account deletion.
 *
 * aiUsage/{uid} sits outside users/{uid} so that no client can edit its own
 * quota, which also means no client can delete it — it survived account
 * deletion entirely until onUserDeleted existed. These tests are the only thing
 * standing between that and a silent regression, because nothing in the app
 * calls the trigger and a missing export produces no error anywhere.
 */
describe("aiUsage cleanup on account deletion", () => {
  it("deletes the usage counter after the auth account is deleted", async () => {
    // Arrange — a user who has actually spent tokens, so the document exists
    await clearUsage();
    const { uid } = await createTestUser();
    // Wait for onUserCreated before touching anything. Both triggers are
    // background functions with no ordering between them, so deleting while
    // the signup write is still in flight lets it land afterwards and
    // resurrect the document — a race the test would create, not one a real
    // user reaches by signing up and deleting seconds later.
    expect(await waitForUsageToExist(uid)).toBe(true);
    await seedUsage(uid, { tier: "free", tokensUsed: 5_000 });
    expect(await readUsage(uid)).toBeDefined();

    // Act — the same call deleteAccount() makes as its final step
    await deleteAuthUser(uid);

    // Assert
    expect(await waitForUsageToBeDeleted(uid)).toBe(true);
  });

  it("leaves other users' counters untouched", async () => {
    // Arrange — a regression here would be catastrophic and silent: a trigger
    // that wiped the collection instead of one document would look identical
    // to a passing test above.
    await clearUsage();
    const { uid: deletedUid } = await createTestUser();
    const { uid: survivingUid } = await createTestUser();
    // Same reason as above: let both signup triggers land before deleting.
    expect(await waitForUsageToExist(deletedUid)).toBe(true);
    expect(await waitForUsageToExist(survivingUid)).toBe(true);
    await seedUsage(deletedUid, { tier: "free", tokensUsed: 5_000 });
    await seedUsage(survivingUid, { tier: "free", tokensUsed: 1_234 });

    // Act
    await deleteAuthUser(deletedUid);

    // Assert
    expect(await waitForUsageToBeDeleted(deletedUid)).toBe(true);
    expect(await readUsage(survivingUid)).toMatchObject({ tokensUsed: 1_234 });
  });

  it("deletes the RevenueCat customer document too", async () => {
    // Arrange — a subscriber, so the extension has written their customer
    // document. It holds purchase history keyed by their uid, and nothing
    // else would ever remove it: clients cannot touch it, by design.
    await clearUsage();
    await clearCustomers();
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);
    const now = Date.now();
    await seedCustomer(uid, {
      entitlements: {
        pro: {
          product_identifier: "hercule_pro_monthly",
          purchase_date: new Date(now).toISOString(),
          expires_date: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      subscriptions: { hercule_pro_monthly: { is_sandbox: false } },
    });
    // Let the sync trigger finish first. Running concurrently with the
    // deletion, it could pass its account check just before the account goes
    // and write aiUsage just after onUserDeleted removed it.
    expect(
      await waitFor(async () => (await readUsage(uid))?.tier === "pro"),
    ).toBe(true);

    // Act
    await deleteAuthUser(uid);

    // Assert
    const customerRef = adminDb.collection("revenuecatCustomers").doc(uid);
    expect(
      await waitFor(async () => !(await customerRef.get()).exists),
    ).toBe(true);
    expect(await waitForUsageToBeDeleted(uid)).toBe(true);
  });

  it("succeeds for a user with no usage document", async () => {
    // Arrange — every account now gets a document from onUserCreated, so the
    // no-document case has to be constructed rather than assumed. It is still
    // reachable in production: onUserCreated swallows its failures precisely
    // because the lazy path in checkQuota is the real guarantee, so a user
    // whose signup write failed and who never opened the coach has none.
    //
    // Waiting for the trigger first, THEN clearing, is what makes this
    // deterministic — clearing straight after createTestUser would race a
    // cold-starting trigger that recreates the document a second later.
    await clearUsage();
    const { uid } = await createTestUser();
    expect(await waitForUsageToExist(uid)).toBe(true);
    await clearUsage();
    expect(await readUsage(uid)).toBeUndefined();

    // Act + Assert — the delete resolving is the whole assertion
    await expect(deleteAuthUser(uid)).resolves.toBeUndefined();
    expect(await readUsage(uid)).toBeUndefined();
  });
});
