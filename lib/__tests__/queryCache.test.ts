import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { createAccountQueryCache } from "../queryCache";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

beforeEach(async () => { await AsyncStorage.clear(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test("each account, signed-out state, and backend has a separate persistence key", () => {
  const caches = [
    createAccountQueryCache("alice", false), createAccountQueryCache("bob", false),
    createAccountQueryCache(null, false), createAccountQueryCache("alice", true),
  ];
  expect(new Set(caches.map((cache) => cache.key)).size).toBe(4);
  for (const { client } of caches) client.clear();
});

test("an old account's late query result cannot populate the new account's cache", async () => {
  const alice = createAccountQueryCache("alice", false);
  const bob = createAccountQueryCache("bob", false);
  let resolve!: (value: string[]) => void;
  const pending = alice.client.fetchQuery({ queryKey: ["exerciseLogs"], queryFn: () => new Promise<string[]>((done) => { resolve = done; }) });
  bob.client.setQueryData(["exerciseLogs"], ["Bob's workout"]);
  resolve(["Alice's workout"]);
  await pending;
  expect(bob.client.getQueryData(["exerciseLogs"])).toEqual(["Bob's workout"]);
  alice.client.clear(); bob.client.clear();
});

test("persisted data restores only for its owner and backend", async () => {
  const alice = createAccountQueryCache("alice", false);
  alice.client.setQueryData(["userSettings"], { measure: "lbs", name: "Alice" });
  const saving = alice.persister.persistClient({ timestamp: Date.now(), buster: "test", clientState: dehydrate(alice.client) });
  await jest.advanceTimersByTimeAsync(1000);
  await saving;
  const returning = createAccountQueryCache("alice", false);
  const restored = await returning.persister.restoreClient();
  expect(restored).toBeDefined();
  hydrate(returning.client, restored!.clientState);
  expect(returning.client.getQueryData(["userSettings"])).toEqual({ measure: "lbs", name: "Alice" });
  const bob = createAccountQueryCache("bob", false);
  const emulator = createAccountQueryCache("alice", true);
  expect(await bob.persister.restoreClient()).toBeUndefined();
  expect(await emulator.persister.restoreClient()).toBeUndefined();
  for (const cache of [alice, returning, bob, emulator]) cache.client.clear();
});

test("the legacy unscoped cache is not restored for a newly signed-in account", async () => {
  await AsyncStorage.setItem("HERCULE_QUERY_CACHE", JSON.stringify({ private: "old account" }));
  const cache = createAccountQueryCache("bob", false);
  expect(await cache.persister.restoreClient()).toBeUndefined();
  cache.client.clear();
});
