/**
 * A small STATEFUL in-memory fake of @react-native-firebase/firestore for unit
 * tests. Unlike a spy mock, it actually STORES documents and APPLIES writes
 * (set/update/add/delete, arrayUnion/arrayRemove, serverTimestamp) and can run
 * where/orderBy/limit queries. That lets a test do "write -> read it back" and
 * assert on the real resulting data.
 *
 * It is deliberately app-agnostic: any code that uses the Firestore chain
 * (collection/doc/where/orderBy/limit/get/set/update/delete/add/batch) can be
 * tested with it. Storage is a flat Map keyed by full path, e.g.
 *   "users/test-user/labels/abc"
 * Sub-collections are just longer paths.
 *
 * It mirrors @react-native-firebase/firestore v23 where the difference matters:
 *  - DocumentSnapshot.exists() is a METHOD (it was a property before v22). Code
 *    that still reads `snap.exists` gets a function, which is always truthy.
 *  - Writing an `undefined` field throws "Unsupported field value: undefined",
 *    as the native SDK does unless ignoreUndefinedProperties is set.
 *  - A batch is atomic. (There is no write-count cap: Firestore removed the
 *    old 500-writes-per-commit limit in March 2023.)
 *
 * NOT supported (add later if you start using them): dotted field paths in
 * update(), transactions, onSnapshot, FieldValue.increment.
 */

export const TEST_UID = "test-user";

// ---------------------------------------------------------------------------
// Sentinels: FieldValue.* returns a tagged object. We detect & apply these
// when a write happens, mimicking what the real Firestore server does.
// ---------------------------------------------------------------------------
type Sentinel =
  | { __op: "serverTimestamp" }
  | { __op: "arrayUnion"; values: unknown[] }
  | { __op: "arrayRemove"; values: unknown[] };

const isSentinel = (v: unknown): v is Sentinel =>
  typeof v === "object" && v !== null && "__op" in v;

const FieldValue = {
  serverTimestamp: (): Sentinel => ({ __op: "serverTimestamp" }),
  arrayUnion: (...values: unknown[]): Sentinel => ({ __op: "arrayUnion", values }),
  arrayRemove: (...values: unknown[]): Sentinel => ({ __op: "arrayRemove", values }),
};

// A minimal Timestamp. serverTimestamp resolves to a real Date (which your Zod
// schema accepts via z.date()); Timestamp.fromDate wraps a Date for queries.
class FakeTimestamp {
  constructor(private readonly date: Date) {}
  toDate(): Date {
    return this.date;
  }
  toMillis(): number {
    return this.date.getTime();
  }
  static fromDate(date: Date): FakeTimestamp {
    return new FakeTimestamp(date);
  }
}

// Turn any comparable (string, number, Date, FakeTimestamp) into a sortable
// primitive so where()/orderBy() can compare apples to apples.
const toComparable = (v: unknown): string | number => {
  if (v instanceof FakeTimestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v as string | number;
};

// RNFB serializes every write and throws on the first undefined it meets,
// at any depth, before anything reaches the database.
const assertNoUndefined = (value: unknown): void => {
  if (value === undefined) {
    throw new Error("Unsupported field value: undefined");
  }
  if (isSentinel(value) || value instanceof Date || value instanceof FakeTimestamp) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoUndefined);
    return;
  }
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(assertNoUndefined);
  }
};

// ---------------------------------------------------------------------------
// The store + write application
// ---------------------------------------------------------------------------
type DocData = Record<string, unknown>;

class Store {
  docs = new Map<string, DocData>();
  /** How many writes each committed batch carried, in commit order. */
  batchSizes: number[] = [];
  private autoCounter = 0;
  nextId(): string {
    this.autoCounter += 1;
    return `auto-id-${this.autoCounter}`;
  }
  reset(): void {
    this.docs.clear();
    this.batchSizes = [];
    this.autoCounter = 0;
  }
}

// Resolve one field value, applying any sentinel against the existing value.
const resolveValue = (value: unknown, existing: unknown): unknown => {
  if (!isSentinel(value)) return value;
  if (value.__op === "serverTimestamp") return new Date();
  const current = Array.isArray(existing) ? [...existing] : [];
  if (value.__op === "arrayUnion") {
    for (const v of value.values) {
      if (!current.includes(v)) current.push(v);
    }
    return current;
  }
  // arrayRemove
  return current.filter((v) => !value.values.includes(v));
};

// Build the new doc data for a write. `base` is the existing doc (for update /
// set-with-merge) or {} (for a plain set that overwrites).
const applyWrite = (base: DocData, patch: DocData): DocData => {
  const next: DocData = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = resolveValue(value, base[key]);
  }
  return next;
};

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------
class DocSnapshot {
  constructor(
    private readonly store: Store,
    readonly path: string,
  ) {}
  get id(): string {
    return this.path.split("/").pop()!;
  }
  exists(): boolean {
    return this.store.docs.has(this.path);
  }
  data(): DocData | undefined {
    const data = this.store.docs.get(this.path);
    return data ? { ...data } : undefined;
  }
  get(field: string): unknown {
    return this.store.docs.get(this.path)?.[field];
  }
  get ref(): DocRef {
    return new DocRef(this.store, this.path);
  }
}

// A doc inside a query result. Always exists; has .data() and .ref.
class QueryDocSnapshot {
  constructor(
    private readonly store: Store,
    readonly path: string,
  ) {}
  get id(): string {
    return this.path.split("/").pop()!;
  }
  exists(): true {
    return true;
  }
  data(): DocData {
    return { ...(this.store.docs.get(this.path) ?? {}) };
  }
  get(field: string): unknown {
    return this.store.docs.get(this.path)?.[field];
  }
  get ref(): DocRef {
    return new DocRef(this.store, this.path);
  }
}

// ---------------------------------------------------------------------------
// References & queries
// ---------------------------------------------------------------------------
interface Filter {
  field: string;
  op: string;
  value: unknown;
}
interface Order {
  field: string;
  dir: "asc" | "desc";
}

class Query {
  constructor(
    protected store: Store,
    protected path: string,
    protected filters: Filter[] = [],
    protected orders: Order[] = [],
    protected limitN?: number,
  ) {}

  where(field: string, op: string, value: unknown): Query {
    return new Query(
      this.store,
      this.path,
      [...this.filters, { field, op, value }],
      this.orders,
      this.limitN,
    );
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc"): Query {
    return new Query(
      this.store,
      this.path,
      this.filters,
      [...this.orders, { field, dir }],
      this.limitN,
    );
  }
  limit(n: number): Query {
    return new Query(this.store, this.path, this.filters, this.orders, n);
  }

  private matches(data: DocData): boolean {
    return this.filters.every(({ field, op, value }) => {
      const a = toComparable(data[field]);
      const b = toComparable(value);
      switch (op) {
        case "==":
          return a === b;
        case "!=":
          return a !== b;
        case ">":
          return a > b;
        case ">=":
          return a >= b;
        case "<":
          return a < b;
        case "<=":
          return a <= b;
        case "array-contains":
          return Array.isArray(data[field]) && (data[field] as unknown[]).includes(value);
        default:
          throw new Error(`Unsupported where op in mock: ${op}`);
      }
    });
  }

  async get(): Promise<{
    empty: boolean;
    size: number;
    docs: QueryDocSnapshot[];
    forEach: (cb: (d: QueryDocSnapshot) => void) => void;
  }> {
    // Direct children of this collection path: "<path>/<id>" (one more segment).
    const prefix = `${this.path}/`;
    let paths = [...this.store.docs.keys()].filter(
      (key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"),
    );

    paths = paths.filter((p) => this.matches(this.store.docs.get(p)!));

    // Like the real server, orderBy(field) silently drops documents that do
    // not have that field at all.
    paths = paths.filter((p) =>
      this.orders.every(({ field }) => field in this.store.docs.get(p)!),
    );

    // The first orderBy is the primary key; later ones only break ties.
    paths.sort((p1, p2) => {
      for (const { field, dir } of this.orders) {
        const a = toComparable(this.store.docs.get(p1)![field]);
        const b = toComparable(this.store.docs.get(p2)![field]);
        const cmp = a < b ? -1 : a > b ? 1 : 0;
        if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });

    if (this.limitN !== undefined) paths = paths.slice(0, this.limitN);

    const docs = paths.map((p) => new QueryDocSnapshot(this.store, p));
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb),
    };
  }
}

// A collection is a Query that can also make doc refs and add().
class CollectionRef extends Query {
  doc(id?: string): DocRef {
    const docId = id ?? this.store.nextId();
    return new DocRef(this.store, `${this.path}/${docId}`);
  }
  async add(data: DocData): Promise<DocRef> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

class DocRef {
  constructor(
    private readonly store: Store,
    readonly path: string,
  ) {}
  get id(): string {
    return this.path.split("/").pop()!;
  }
  collection(name: string): CollectionRef {
    return new CollectionRef(this.store, `${this.path}/${name}`);
  }
  async get(): Promise<DocSnapshot> {
    return new DocSnapshot(this.store, this.path);
  }
  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    assertNoUndefined(data);
    const base = options?.merge ? (this.store.docs.get(this.path) ?? {}) : {};
    this.store.docs.set(this.path, applyWrite(base, data));
  }
  async update(data: DocData): Promise<void> {
    assertNoUndefined(data);
    const existing = this.store.docs.get(this.path);
    if (!existing) {
      throw new Error(`No document to update: ${this.path}`);
    }
    this.store.docs.set(this.path, applyWrite(existing, data));
  }
  async delete(): Promise<void> {
    this.store.docs.delete(this.path);
  }
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------
class Batch {
  private ops: (() => Promise<void>)[] = [];
  set(ref: DocRef, data: DocData, options?: { merge?: boolean }): Batch {
    assertNoUndefined(data);
    this.ops.push(() => ref.set(data, options));
    return this;
  }
  update(ref: DocRef, data: DocData): Batch {
    assertNoUndefined(data);
    this.ops.push(() => ref.update(data));
    return this;
  }
  delete(ref: DocRef): Batch {
    this.ops.push(() => ref.delete());
    return this;
  }
  constructor(private readonly store: Store) {}
  async commit(): Promise<void> {
    // All or nothing: a failing op rolls back the ones before it.
    const before = new Map(this.store.docs);
    try {
      for (const op of this.ops) await op();
    } catch (error) {
      this.store.docs = before;
      throw error;
    }
    this.store.batchSizes.push(this.ops.length);
  }
}

// ---------------------------------------------------------------------------
// The mock module: a callable firestore() with static FieldValue/Timestamp,
// plus test-only helpers (_reset, _seed, _read) hung off the same function.
// ---------------------------------------------------------------------------
const store = new Store();

const firestoreMock = Object.assign(
  () => ({
    collection: (name: string) => new CollectionRef(store, name),
    batch: () => new Batch(store),
  }),
  {
    FieldValue,
    Timestamp: FakeTimestamp,
  },
);

/** Wipe all data between tests (call in beforeEach). */
export const resetFirestore = (): void => store.reset();

/** Seed a doc directly. e.g. seedDoc(["users", TEST_UID, "labels", "A"], {...}). */
export const seedDoc = (segments: string[], data: DocData): void => {
  store.docs.set(segments.join("/"), { ...data });
};

/** Read a doc's raw stored data (bypasses Zod). undefined if missing. */
export const readDoc = (segments: string[]): DocData | undefined => {
  const data = store.docs.get(segments.join("/"));
  return data ? { ...data } : undefined;
};

/** Every stored path that starts with the given segments. */
export const listPaths = (segments: string[] = []): string[] => {
  const prefix = segments.length ? `${segments.join("/")}/` : "";
  return [...store.docs.keys()].filter((key) => key.startsWith(prefix)).sort();
};

/** Sizes of the batches committed since the last reset, in order. */
export const committedBatchSizes = (): number[] => [...store.batchSizes];

export { FakeTimestamp, firestoreMock };
export default firestoreMock;
