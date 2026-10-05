import firestore from "@react-native-firebase/firestore";
import { adminDb, caught, readAsAdmin, signInAs, signOutUser, signUpNewUser, type TestUser } from "./support/emulator";

const collections = ["fitnessLogs", "exerciseNames", "labels", "dayAssignments", "programs", "weightLogs"] as const;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await signUpNewUser();
  bob = await signUpNewUser();
  const batch = adminDb.batch();
  for (const name of collections) batch.set(adminDb.doc(`users/${alice.uid}/${name}/private`), { marker: "private" });
  await batch.commit();
});
beforeEach(async () => { await signInAs(bob); });

describe.each(collections)("ownership rules for %s", (name) => {
  const otherCollection = () => firestore().collection("users").doc(alice.uid).collection(name);

  test("the owner can create, update, read, list, and delete (authenticated control)", async () => {
    const collection = firestore().collection("users").doc(bob.uid).collection(name);
    const ref = collection.doc("control");
    await ref.set({ marker: "original" });
    await ref.update({ marker: "changed" });
    expect((await ref.get()).data()?.marker).toBe("changed");
    expect((await collection.get()).docs.map((doc) => doc.id)).toContain("control");
    await ref.delete();
    expect((await ref.get()).exists()).toBe(false);
  });

  test.each(["read", "list", "create", "update", "delete"] as const)("another account cannot %s", async (operation) => {
    const collection = otherCollection();
    const ref = collection.doc("private");
    const attempts = {
      read: () => ref.get(), list: () => collection.get(),
      create: () => collection.doc("forged").set({ marker: "forged" }),
      update: () => ref.update({ marker: "forged" }), delete: () => ref.delete(),
    };
    expect((await caught(attempts[operation])).code).toBe("firestore/permission-denied");
    expect(await readAsAdmin(ref.path)).toEqual({ marker: "private" });
  });
});

test("one forbidden write rejects a whole batch, including the caller's otherwise allowed write", async () => {
  const own = firestore().collection("users").doc(bob.uid).collection("fitnessLogs").doc("atomic");
  const other = firestore().collection("users").doc(alice.uid).collection("fitnessLogs").doc("private");
  const batch = firestore().batch();
  batch.set(own, { marker: "allowed" });
  batch.update(other, { marker: "forged" });
  expect((await caught(() => batch.commit())).code).toBe("firestore/permission-denied");
  expect(await readAsAdmin(own.path)).toBeUndefined();
  expect(await readAsAdmin(other.path)).toEqual({ marker: "private" });
});

test.each(["aiUsage", "revenuecatCustomers", "consentEvents"])("clients cannot list or update the server-only %s collection", async (name) => {
  await adminDb.doc(`${name}/${bob.uid}`).set({ marker: "server-owned" });
  const collection = firestore().collection(name);
  const ref = collection.doc(bob.uid);
  expect((await caught(() => collection.get())).code).toBe("firestore/permission-denied");
  expect((await caught(() => ref.update({ marker: "forged" }))).code).toBe("firestore/permission-denied");
  expect((await caught(() => ref.delete())).code).toBe("firestore/permission-denied");
  expect(await readAsAdmin(ref.path)).toEqual({ marker: "server-owned" });
});

test("signed-out clients cannot write even to the account that was just signed in", async () => {
  await signOutUser();
  const ref = firestore().collection("users").doc(bob.uid).collection("fitnessLogs").doc("signed-out");
  expect((await caught(() => ref.set({ marker: "forged" }))).code).toBe("firestore/permission-denied");
  expect(await readAsAdmin(ref.path)).toBeUndefined();
});
