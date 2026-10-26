import type { DocumentReference, Query } from "@react-native-firebase/firestore";

/**
 * The few Firestore shapes the data layer reads.
 *
 * The references are React Native Firebase's own types with the default
 * DocumentData model, so getDoc() and getDocs() keep that data type. The
 * snapshot interfaces below are the narrower views the data layer and the
 * in-memory fake share.
 */

/** A document reference. */
export type DocRef = DocumentReference;

/** A collection, or a filtered and ordered view of one. */
export type QueryRef = Query;

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
