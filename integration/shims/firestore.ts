/**
 * Stand-in for @react-native-firebase/firestore: RNFB v23's namespaced API,
 * implemented over the Firebase JS SDK and the Firestore emulator.
 *
 * Mirrors the device where it matters, because the point is to catch what the
 * device would do:
 *  - DocumentSnapshot.exists() is a METHOD, as in RNFB v22+.
 *  - Errors carry RNFB's namespaced codes ("firestore/permission-denied"), not
 *    the JS SDK's bare ones.
 *  - `firestore.Timestamp` is the SDK's Timestamp class, so the app's Zod
 *    `instanceof firestore.Timestamp` check sees real Timestamps.
 * Undefined field values are rejected by the JS SDK itself, as on device.
 */
import * as fs from "firebase/firestore";
import { EMULATOR_HOST, firebaseApp } from "./app";

const FIRESTORE_PORT = 8080;

export const jsDb = fs.getFirestore(firebaseApp);
fs.connectFirestoreEmulator(jsDb, EMULATOR_HOST, FIRESTORE_PORT);

type Data = Record<string, unknown>;

/** Rethrows SDK errors with the code and message shape RNFB produces. */
const asRnfbError = (error: unknown): never => {
  const { code, message } = error as { code?: string; message?: string };
  if (!code || code.startsWith("firestore/")) throw error;

  throw Object.assign(new Error(`[firestore/${code}] ${message}`), {
    code: `firestore/${code}`,
    cause: error,
  });
};

const rnfb = <T>(promise: Promise<T>): Promise<T> => promise.catch(asRnfbError);

class DocumentSnapshot {
  constructor(private readonly snap: fs.DocumentSnapshot) {}
  get id(): string {
    return this.snap.id;
  }
  get ref(): DocumentReference {
    return new DocumentReference(this.snap.ref);
  }
  exists(): boolean {
    return this.snap.exists();
  }
  data(): Data | undefined {
    return this.snap.data();
  }
  get(field: string): unknown {
    return this.snap.get(field);
  }
}

class QuerySnapshot {
  readonly docs: DocumentSnapshot[];
  constructor(snap: fs.QuerySnapshot) {
    this.docs = snap.docs.map((doc) => new DocumentSnapshot(doc));
  }
  get empty(): boolean {
    return this.docs.length === 0;
  }
  get size(): number {
    return this.docs.length;
  }
  forEach(callback: (doc: DocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

class Query {
  constructor(
    protected readonly jsQuery: fs.Query,
    protected readonly constraints: fs.QueryConstraint[] = [],
  ) {}
  private with(constraint: fs.QueryConstraint): Query {
    return new Query(this.jsQuery, [...this.constraints, constraint]);
  }
  where(field: string, op: fs.WhereFilterOp, value: unknown): Query {
    return this.with(fs.where(field, op, value));
  }
  orderBy(field: string, direction: fs.OrderByDirection = "asc"): Query {
    return this.with(fs.orderBy(field, direction));
  }
  limit(n: number): Query {
    return this.with(fs.limit(n));
  }
  async get(): Promise<QuerySnapshot> {
    const snap = await rnfb(fs.getDocs(fs.query(this.jsQuery, ...this.constraints)));
    return new QuerySnapshot(snap);
  }
}

class CollectionReference extends Query {
  constructor(private readonly jsRef: fs.CollectionReference) {
    super(jsRef);
  }
  get id(): string {
    return this.jsRef.id;
  }
  get path(): string {
    return this.jsRef.path;
  }
  doc(id?: string): DocumentReference {
    return new DocumentReference(id === undefined ? fs.doc(this.jsRef) : fs.doc(this.jsRef, id));
  }
  async add(data: Data): Promise<DocumentReference> {
    return new DocumentReference(await rnfb(fs.addDoc(this.jsRef, data)));
  }
}

class DocumentReference {
  constructor(readonly js: fs.DocumentReference) {}
  get id(): string {
    return this.js.id;
  }
  get path(): string {
    return this.js.path;
  }
  collection(name: string): CollectionReference {
    return new CollectionReference(fs.collection(this.js, name));
  }
  async get(): Promise<DocumentSnapshot> {
    return new DocumentSnapshot(await rnfb(fs.getDoc(this.js)));
  }
  set(data: Data, options?: fs.SetOptions): Promise<void> {
    return rnfb(options ? fs.setDoc(this.js, data, options) : fs.setDoc(this.js, data));
  }
  update(data: Data): Promise<void> {
    return rnfb(fs.updateDoc(this.js, data));
  }
  delete(): Promise<void> {
    return rnfb(fs.deleteDoc(this.js));
  }
}

class WriteBatch {
  private readonly batch = fs.writeBatch(jsDb);
  set(ref: DocumentReference, data: Data, options?: fs.SetOptions): WriteBatch {
    if (options) this.batch.set(ref.js, data, options);
    else this.batch.set(ref.js, data);
    return this;
  }
  update(ref: DocumentReference, data: Data): WriteBatch {
    this.batch.update(ref.js, data);
    return this;
  }
  delete(ref: DocumentReference): WriteBatch {
    this.batch.delete(ref.js);
    return this;
  }
  commit(): Promise<void> {
    return rnfb(this.batch.commit());
  }
}

const instance = {
  collection: (path: string) => new CollectionReference(fs.collection(jsDb, path)),
  doc: (path: string) => new DocumentReference(fs.doc(jsDb, path)),
  batch: () => new WriteBatch(),
};

const FieldValue = {
  serverTimestamp: fs.serverTimestamp,
  arrayUnion: fs.arrayUnion,
  arrayRemove: fs.arrayRemove,
  increment: fs.increment,
  delete: fs.deleteField,
};

const firestore = Object.assign(() => instance, {
  FieldValue,
  Timestamp: fs.Timestamp,
});

export const Timestamp = fs.Timestamp;
export default firestore;
