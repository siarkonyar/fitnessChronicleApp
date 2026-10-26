/**
 * The completeness check account.ts says cannot exist.
 *
 * Firestore does not cascade, so deleteAccount walks a hard-coded list of
 * subcollections. A collection added under users/{uid} and not added to that
 * list survives account deletion as orphaned personal data — and programs,
 * weightLogs and dayAssignments were each missed exactly that way.
 *
 * This scans every app source file for the collections it writes to and fails
 * the moment one is missing from SUBCOLLECTIONS.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..", "..", "..");
const SOURCE_DIRS = ["app", "components", "context", "hooks", "lib"];

/** Top-level collections. Only the server touches the ones besides users. */
const TOP_LEVEL = new Set(["users", "aiUsage", "revenuecatCustomers", "consentEvents"]);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === "__tests__" || entry === "node_modules" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

const collectionsUsedByTheApp = (): Map<string, string[]> => {
  const usedIn = new Map<string, string[]>();

  for (const file of SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))) {
    const source = readFileSync(file, "utf8");
    const names = [
      // Namespaced chain: .collection("name")
      ...[...source.matchAll(/\.collection\(\s*["'`]([^"'`]+)["'`]/g)].map(([, name]) => name),
      // Modular paths: collection(db, "users", uid, "name") and doc(db, "users", uid, ...).
      // Every quoted segment in such a path is a collection name; ids are variables.
      ...[...source.matchAll(/\b(?:collection|doc)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].flatMap(
        ([, args]) => [...args.matchAll(/["'`]([^"'`]+)["'`]/g)].map(([, name]) => name),
      ),
    ];
    for (const name of names) {
      usedIn.set(name, [...(usedIn.get(name) ?? []), relative(ROOT, file)]);
    }
  }

  return usedIn;
};

const deletedSubcollections = (): string[] => {
  const source = readFileSync(join(ROOT, "lib/firebase/account.ts"), "utf8");
  const list = source.match(/const SUBCOLLECTIONS = \[([\s\S]*?)\] as const/);
  if (!list) throw new Error("SUBCOLLECTIONS not found in lib/firebase/account.ts");

  return [...list[1].matchAll(/"([^"]+)"/g)].map(([, name]) => name);
};

describe("account deletion coverage", () => {
  test("the scan actually finds the app's collections", () => {
    // Guards the guard: a broken regex would find nothing and pass vacuously.
    expect([...collectionsUsedByTheApp().keys()]).toEqual(
      expect.arrayContaining(["users", "fitnessLogs", "labels"]),
    );
  });

  test("every subcollection the app writes under users/{uid} is deleted with the account", () => {
    const deleted = new Set(deletedSubcollections());

    const missing = [...collectionsUsedByTheApp()]
      .filter(([name]) => !TOP_LEVEL.has(name) && !deleted.has(name))
      .map(([name, files]) => `${name} (used in ${files.join(", ")})`);

    expect(missing).toEqual([]);
  });

  test("the deletion list has no stale entries the app no longer uses", () => {
    const used = collectionsUsedByTheApp();

    expect(deletedSubcollections().filter((name) => !used.has(name))).toEqual([]);
  });

  test("the app never touches a server-only collection directly", () => {
    const used = collectionsUsedByTheApp();

    for (const serverOnly of ["aiUsage", "revenuecatCustomers", "consentEvents"]) {
      expect(used.get(serverOnly)).toBeUndefined();
    }
  });
});
