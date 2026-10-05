/**
 * Shared plumbing for the app's emulator-backed integration suites.
 *
 * Every suite signs up its own random user through the Auth emulator, so the
 * app's real code runs with a real ID token and Firestore evaluates the real
 * firestore.rules. The Admin SDK side bypasses the rules: it seeds server-only
 * documents (aiUsage) and inspects what the app left behind.
 *
 * Nothing here reaches Gemini. Every coach call under test is refused before
 * the model runs, so the suite needs no real API key and costs nothing.
 */
import { randomUUID } from "node:crypto";
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import {
  Timestamp as AdminTimestamp,
  getFirestore as getAdminFirestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import { deleteApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { terminate } from "firebase/firestore";
import { PROJECT_ID, firebaseApp } from "../shims/app";
import { jsAuthInstance } from "../shims/auth";
import { jsDb } from "../shims/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Emulator hosts are unset — run `npm run test:integration`.");
}

/** Emulator-only. The auth emulator does not check password strength. */
const TEST_PASSWORD = "emulator-only-password";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 250;

const adminApp = initializeAdminApp({ projectId: PROJECT_ID }, `admin-${randomUUID()}`);

if (!adminApp.options.projectId?.startsWith("demo-")) {
  throw new Error(`Refusing to run against non-demo project "${adminApp.options.projectId}".`);
}

/** Bypasses firestore.rules. For seeding and inspection only. */
export const adminDb = getAdminFirestore(adminApp);
export const adminAuth = getAdminAuth(adminApp);

export interface TestUser {
  uid: string;
  email: string;
}

/** Creates a fresh user in the Auth emulator and leaves them signed in. */
export const signUpNewUser = async (): Promise<TestUser> => {
  const email = `test-${randomUUID()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(jsAuthInstance, email, TEST_PASSWORD);
  return { uid: user.uid, email };
};

export const signInAs = async ({ email }: TestUser): Promise<void> => {
  await signInWithEmailAndPassword(jsAuthInstance, email, TEST_PASSWORD);
};

export const signOutUser = (): Promise<void> => signOut(jsAuthInstance);

export const TEST_CREDENTIAL_PASSWORD = TEST_PASSWORD;

/** Every document path stored under users/{uid}, at any depth. */
export const pathsUnderUser = async (uid: string): Promise<string[]> => {
  const walk = async (ref: DocumentReference): Promise<string[]> => {
    const own = (await ref.get()).exists ? [ref.path] : [];
    const collections = await ref.listCollections();
    const nested = await Promise.all(
      collections.map(async (collection) => {
        const docs = await collection.listDocuments();
        return (await Promise.all(docs.map(walk))).flat();
      }),
    );
    return [...own, ...nested.flat()];
  };

  return (await walk(adminDb.doc(`users/${uid}`))).sort();
};

export const readAsAdmin = async (path: string) => (await adminDb.doc(path).get()).data();

export interface UsageSeed {
  tier?: "free" | "pro" | "max";
  tokensUsed?: number;
  periodEnd?: Date;
  entitlementExpiresAt?: Date;
  productId?: string;
  rateTokens?: number;
  rateLastRefill?: number;
}

/**
 * Writes aiUsage/{uid} the way the server does. periodEnd defaults to the
 * future, because a past one reads as a rollover and resets tokensUsed.
 */
export const seedUsage = async (
  uid: string,
  { periodEnd, entitlementExpiresAt, ...fields }: UsageSeed,
): Promise<void> => {
  await adminDb.doc(`aiUsage/${uid}`).set(
    {
      ...fields,
      periodEnd: AdminTimestamp.fromDate(periodEnd ?? new Date(Date.now() + 30 * MS_PER_DAY)),
      ...(entitlementExpiresAt && {
        entitlementExpiresAt: AdminTimestamp.fromDate(entitlementExpiresAt),
      }),
    },
    { merge: true },
  );
};

export const daysFromNow = (days: number): Date => new Date(Date.now() + days * MS_PER_DAY);

/** Polls until `check` passes, for work done by background triggers. */
export const waitFor = async (check: () => Promise<boolean>, timeoutMs = 20_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
};

/** Runs something expected to fail and returns its error; throws if it succeeds. */
export const caught = async (run: () => Promise<unknown>): Promise<{ code?: string; message: string; details?: unknown }> => {
  try {
    await run();
  } catch (error) {
    return error as { code?: string; message: string; details?: unknown };
  }
  throw new Error("Expected the call to fail, but it succeeded.");
};

afterAll(async () => {
  await signOut(jsAuthInstance).catch(() => undefined);
  await terminate(jsDb);
  await deleteApp(firebaseApp);
  await deleteAdminApp(adminApp);
});
