import type { doc, query } from "@react-native-firebase/firestore";

/**
 * The few Firestore shapes the data layer reads, named without a type
 * namespace.
 *
 * React Native Firebase 23 names its modular types only through the
 * FirebaseFirestoreTypes namespace, which v26 removes, and its getDocs()
 * typings resolve to `any` because their generic parameters do not line up.
 * These compile against 23 and also match the firebase-js-sdk-style types
 * that later versions export.
 */

/** A document reference. */
export type DocRef = ReturnType<typeof doc>;

/** A collection, or a filtered and ordered view of one. */
export type QueryRef = ReturnType<typeof query>;

/** A document read on its own, which may not exist. */
export interface DocSnapshot {
  id: string;
  ref: DocRef;
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

/** A document in a query result, which always exists. */
export interface QueryDoc {
  id: string;
  ref: DocRef;
  data(): Record<string, unknown>;
}

/** The result of getDocs(). */
export interface QueryResult {
  empty: boolean;
  docs: QueryDoc[];
}
