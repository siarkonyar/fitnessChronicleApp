import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { clientDb, createTestUser } from "./setup.js";

/**
 * What a signed-in user can do to the documents that decide what they may
 * spend, when they talk to Firestore directly instead of through the app.
 *
 * aiUsage/{uid} is the spend authority and revenuecatCustomers/{uid} is what
 * the trigger copies onto it. Both are top-level precisely so the catch-all
 * deny in firestore.rules covers them. If either ever moved under
 * users/{uid}/, the blanket allow there would let a user write "max until
 * 2099" onto their own account — and these tests would go red.
 *
 * Every test goes through clientDb, the client SDK as the app uses it, so
 * the emulator evaluates the real firestore.rules.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A plan nobody paid for, the thing a forger would write. */
const FORGED_PLAN = {
  entitlements: {
    max: {
      product_identifier: "hercule_max_yearly",
      purchase_date: new Date().toISOString(),
      expires_date: new Date(Date.now() + 365 * 50 * DAY).toISOString(),
    },
  },
  subscriptions: { hercule_max_yearly: { is_sandbox: false } },
};

/** Resolves to the Firestore error code, or throws if the call succeeded. */
const deniedCode = async (attempt: () => Promise<unknown>): Promise<string> => {
  try {
    await attempt();
  } catch (error: unknown) {
    return (error as { code?: string }).code ?? "unknown";
  }

  throw new Error("Expected Firestore to refuse, but the call succeeded.");
};

describe("firestore.rules", () => {
  let uid: string;

  beforeAll(async () => {
    // Signs the client in as this user, so every call below carries a real ID
    // token for them.
    ({ uid } = await createTestUser());
  });

  it("lets a user write their own profile (control)", async () => {
    // Proves the client is signed in and the rules are being evaluated. Without
    // it, every refusal below could be passing for the wrong reason — a
    // client that is not signed in is refused everything.
    const ref = doc(clientDb, "users", uid);

    await setDoc(ref, { rulesTestControl: true }, { merge: true });

    expect((await getDoc(ref)).data()?.rulesTestControl).toBe(true);
  });

  describe("revenuecatCustomers/{uid}", () => {
    it("refuses a user reading their own customer document", async () => {
      const ref = doc(clientDb, "revenuecatCustomers", uid);

      expect(await deniedCode(() => getDoc(ref))).toBe("permission-denied");
    });

    it("refuses a user writing a plan onto their own customer document", async () => {
      const ref = doc(clientDb, "revenuecatCustomers", uid);

      expect(await deniedCode(() => setDoc(ref, FORGED_PLAN))).toBe(
        "permission-denied",
      );
    });

    it("refuses a user deleting their own customer document", async () => {
      const ref = doc(clientDb, "revenuecatCustomers", uid);

      expect(await deniedCode(() => deleteDoc(ref))).toBe("permission-denied");
    });
  });

  describe("aiUsage/{uid}", () => {
    it("refuses a user reading their own usage counter", async () => {
      // The app reads its allowance through getUsagePercentage, which returns
      // a percentage. The raw document holds token counts, which say what a
      // turn costs us.
      const ref = doc(clientDb, "aiUsage", uid);

      expect(await deniedCode(() => getDoc(ref))).toBe("permission-denied");
    });

    it("refuses a user zeroing their own usage counter", async () => {
      const ref = doc(clientDb, "aiUsage", uid);

      expect(
        await deniedCode(() => setDoc(ref, { tokensUsed: 0 }, { merge: true })),
      ).toBe("permission-denied");
    });

    it("refuses a user giving themselves a paid tier", async () => {
      const ref = doc(clientDb, "aiUsage", uid);

      expect(
        await deniedCode(() => setDoc(ref, { tier: "max" }, { merge: true })),
      ).toBe("permission-denied");
    });
  });
});
