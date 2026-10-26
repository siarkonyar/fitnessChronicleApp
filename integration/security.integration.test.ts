/**
 * firestore.rules as the app meets them: two real users on one emulator, the
 * app's own helpers, and the same SDK surface a tampered client would have.
 *
 * The helpers always scope to the signed-in uid, so the interesting question
 * is what a client that bypasses them can reach — anything it can read or
 * write here, a modified build can too.
 */
import firestore from "./shims/firestore";
import { addExerciseLog, getAllExerciseNames, getExerciseLogByDate } from "@/lib/firebase/exercise";
import { addLabel, getAllLabels } from "@/lib/firebase/label";
import { getPrograms, addProgram } from "@/lib/firebase/program";
import { getUserSettings } from "@/lib/firebase/user";
import { makeLabel, makeLog } from "@/lib/firebase/__tests__/fixtures";
import {
  caught,
  readAsAdmin,
  seedUsage,
  signInAs,
  signOutUser,
  signUpNewUser,
  type TestUser,
} from "./support/emulator";

const db = () => firestore();

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await signUpNewUser();
  await addExerciseLog(makeLog({ date: "2026-06-10", notes: "alice's private note" }));
  await addLabel(makeLabel({ description: "Alice push" }));
  await addProgram("Alice PPL", []);

  bob = await signUpNewUser();
});

beforeEach(async () => {
  await signInAs(bob);
});

const denied = async (run: () => Promise<unknown>) => (await caught(run)).code;

describe("another user's data", () => {
  test("the app's helpers show Bob only his own (empty) data", async () => {
    expect(await getExerciseLogByDate("2026-06-10")).toEqual([]);
    expect(await getAllLabels()).toEqual([]);
    expect(await getPrograms()).toEqual([]);
    expect(await getAllExerciseNames()).toEqual([]);
  });

  test("Bob cannot read Alice's logs by addressing them directly", async () => {
    const aliceLogs = db().collection("users").doc(alice.uid).collection("fitnessLogs");

    expect(await denied(() => aliceLogs.get())).toBe("firestore/permission-denied");
  });

  test("Bob cannot read Alice's user document", async () => {
    expect(await denied(() => db().collection("users").doc(alice.uid).get())).toBe(
      "firestore/permission-denied",
    );
  });

  test("Bob cannot write into Alice's account", async () => {
    const write = () =>
      db().collection("users").doc(alice.uid).collection("fitnessLogs").add(makeLog({ notes: "planted" }));

    expect(await denied(write)).toBe("firestore/permission-denied");
  });

  test("Bob cannot change Alice's streak or settings", async () => {
    const write = () => db().collection("users").doc(alice.uid).set({ streakWeeks: 0 }, { merge: true });

    expect(await denied(write)).toBe("firestore/permission-denied");
  });

  test("nobody can list every user", async () => {
    expect(await denied(() => db().collection("users").get())).toBe("firestore/permission-denied");
  });
});

describe("signed-out clients", () => {
  beforeEach(async () => {
    await signOutUser();
  });

  test("the app's helpers refuse before making a request", async () => {
    await expect(getUserSettings()).rejects.toThrow("User not authenticated");
    await expect(addExerciseLog(makeLog())).rejects.toThrow("User not authenticated");
  });

  test("a direct read of a user's data is denied", async () => {
    const read = () => db().collection("users").doc(alice.uid).collection("labels").get();

    expect(await denied(read)).toBe("firestore/permission-denied");
  });
});

describe("server-only collections", () => {
  test("a user cannot read their own AI allowance", async () => {
    await seedUsage(bob.uid, { tier: "free", tokensUsed: 10 });

    expect(await denied(() => db().collection("aiUsage").doc(bob.uid).get())).toBe(
      "firestore/permission-denied",
    );
  });

  test("a user cannot grant themselves a paid tier", async () => {
    const forge = () =>
      db().collection("aiUsage").doc(bob.uid).set({ tier: "max", tokensUsed: 0 }, { merge: true });

    expect(await denied(forge)).toBe("firestore/permission-denied");
    expect((await readAsAdmin(`aiUsage/${bob.uid}`))?.tier).not.toBe("max");
  });

  test("a user cannot forge or erase consent audit records", async () => {
    const forge = () => db().collection("consentEvents").add({ uid: bob.uid, granted: true });

    expect(await denied(forge)).toBe("firestore/permission-denied");
    expect(await denied(() => db().collection("consentEvents").get())).toBe("firestore/permission-denied");
  });
});

describe("what the rules deliberately leave to the client", () => {
  // Pinned, not bugs: the rules check ownership only, never shape. Each of
  // these is something a modified client can do to its OWN account.

  test("a user can write any field to their own document, including the streak", async () => {
    await db().collection("users").doc(bob.uid).set({ streakWeeks: 999 }, { merge: true });

    expect((await readAsAdmin(`users/${bob.uid}`))?.streakWeeks).toBe(999);
  });

  test("a user can create subcollections the app does not know about", async () => {
    // deleteAccount only removes the subcollections it lists, so data written
    // here would survive account deletion.
    await db().collection("users").doc(bob.uid).collection("scratch").add({ anything: true });

    expect((await db().collection("users").doc(bob.uid).collection("scratch").get()).size).toBe(1);
  });

  test("a user can store a document the app's schema would refuse to read", async () => {
    await db().collection("users").doc(bob.uid).collection("fitnessLogs").add({ date: "2026-06-11", activity: "x" });

    await expect(getExerciseLogByDate("2026-06-11")).rejects.toThrow();
  });
});
