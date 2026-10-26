import {
  collection,
  doc,
  firestoreMock,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  resetFirestore,
  seedDoc,
  setDoc,
  where,
} from "./firestoreTestUtils";

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

describe("optimistic transactions", () => {
  test("retries a stale read instead of losing a concurrent update", async () => {
    const ref = firestoreMock().collection("counters").doc("one");
    await ref.set({ value: 0 });
    const attempts = [0, 0];
    await Promise.all(attempts.map((_, index) => firestoreMock().runTransaction(async (transaction) => {
      attempts[index]++;
      const snapshot = await transaction.get(ref);
      transaction.update(ref, { value: Number(snapshot.data()?.value) + 1 });
    })));
    expect((await ref.get()).data()?.value).toBe(2);
    expect(attempts.reduce((total, count) => total + count, 0)).toBe(3);
  });

  test("a failing write or callback rolls back all transaction writes", async () => {
    const ref = firestoreMock().collection("counters").doc("one");
    const missing = firestoreMock().collection("counters").doc("missing");
    await ref.set({ value: 0 });
    await expect(firestoreMock().runTransaction(async (transaction) => {
      transaction.update(ref, { value: 1 });
      transaction.update(missing, { value: 1 });
    })).rejects.toThrow("No document to update");
    await expect(firestoreMock().runTransaction(async (transaction) => {
      transaction.update(ref, { value: 2 });
      throw new Error("Callback failure");
    })).rejects.toThrow("Callback failure");
    expect((await ref.get()).data()?.value).toBe(0);
  });

  test("rejects a read after a write", async () => {
    const ref = firestoreMock().collection("counters").doc("one");
    await expect(firestoreMock().runTransaction(async (transaction) => {
      transaction.set(ref, { value: 1 });
      await transaction.get(ref);
    })).rejects.toThrow("all reads before writes");
    expect((await ref.get()).exists()).toBe(false);
  });
});

describe("Firestore fake modular API", () => {
  test("builds the same paths as the namespaced chain", async () => {
    await setDoc(doc(getFirestore(), "users", "u1", "labels", "a"), { label: "A" });

    expect((await firestoreMock().collection("users").doc("u1").collection("labels").doc("a").get()).data())
      .toEqual({ label: "A" });
    expect((await getDoc(doc(getFirestore(), "users", "u1", "labels", "a"))).exists()).toBe(true);
  });

  test("rejects paths with the wrong number of segments, as the SDK does", async () => {

    expect(() => doc(getFirestore(), "users")).toThrow("Invalid document reference: users");
    expect(() => collection(getFirestore(), "users", "u1")).toThrow(
      "Invalid collection reference: users/u1",
    );
  });

  test("doc() on a collection gives a new id under it", async () => {
    const labels = collection(getFirestore(), "users", "u1", "labels");

    const first = doc(labels);
    const second = doc(labels);

    expect(first.path).toMatch(/^users\/u1\/labels\/auto-id-\d+$/);
    expect(first.id).not.toBe(second.id);
  });

  test("query constraints filter, order and limit like the chain", async () => {
    for (const [id, value] of [["a", 3], ["b", 1], ["c", 2], ["d", 9]] as const) {
      seedDoc(["items", id], { value, kind: id === "d" ? "other" : "kept" });
    }

    const snapshot = await getDocs(
      query(
        collection(getFirestore(), "items"),
        where("kind", "==", "kept"),
        orderBy("value", "desc"),
        limit(2),
      ),
    );

    expect(snapshot.docs.map((entry) => entry.id)).toEqual(["a", "c"]);
  });
});
