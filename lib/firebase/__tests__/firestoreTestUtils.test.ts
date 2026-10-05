import { firestoreMock, resetFirestore, seedDoc } from "./firestoreTestUtils";

beforeEach(resetFirestore);

describe("Firestore fake snapshot fidelity", () => {
  test("a document snapshot retains its data and existence after later writes and deletes", async () => {
    const ref = firestoreMock().collection("test").doc("one");
    await ref.set({ value: 1 });
    const before = await ref.get();
    await ref.update({ value: 2 });
    await ref.delete();
    expect(before.exists()).toBe(true);
    expect(before.data()).toEqual({ value: 1 });
    expect(before.get("value")).toBe(1);
    expect((await ref.get()).exists()).toBe(false);
  });

  test("a missing-document snapshot stays missing after the document is created", async () => {
    const ref = firestoreMock().collection("test").doc("one");
    const before = await ref.get();
    await ref.set({ value: 1 });
    expect(before.exists()).toBe(false);
    expect(before.data()).toBeUndefined();
  });

  test("query snapshots retain their original rows after update and delete", async () => {
    const collection = firestoreMock().collection("test");
    await collection.doc("one").set({ value: 1 });
    const before = await collection.get();
    await collection.doc("one").update({ value: 2 });
    await collection.doc("one").delete();
    expect(before.docs[0].data()).toEqual({ value: 1 });
    expect(before.docs[0].get("value")).toBe(1);
    expect(before.docs[0].exists()).toBe(true);
  });

  test("mutating data returned by a snapshot cannot change the store or the next read", async () => {
    seedDoc(["test", "one"], { nested: { dates: ["2026-01-01"] } });
    const ref = firestoreMock().collection("test").doc("one");
    const snapshot = await ref.get();
    const data = snapshot.data() as { nested: { dates: string[] } };
    data.nested.dates.push("2026-01-02");
    expect(snapshot.data()).toEqual({ nested: { dates: ["2026-01-01"] } });
    expect((await ref.get()).data()).toEqual(snapshot.data());
  });

  test("a failed batch leaves all documents unchanged", async () => {
    const collection = firestoreMock().collection("test");
    await collection.doc("one").set({ value: 1 });
    const batch = firestoreMock().batch();
    batch.update(collection.doc("one"), { value: 2 });
    batch.update(collection.doc("missing"), { value: 3 });
    await expect(batch.commit()).rejects.toThrow("No document to update");
    expect((await collection.doc("one").get()).data()).toEqual({ value: 1 });
    expect((await collection.doc("missing").get()).exists()).toBe(false);
  });
});
