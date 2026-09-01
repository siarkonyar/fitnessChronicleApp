/**
 * Shared plumbing for the emulator-backed integration suites.
 *
 * These tests go over the wire on purpose. Handing `{ auth: undefined }` to a
 * handler in a unit test only proves our own `if` fires — it says nothing
 * about whether the Functions SDK actually rejects an anonymous caller, which
 * is the thing we care about.
 *
 * Nothing here ever reaches Gemini. Every guard under test rejects before the
 * model is called, so the whole suite runs with no API key and no cost.
 */
import { randomUUID } from "node:crypto";
import {
  deleteApp as deleteAdminApp,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { afterAll } from "vitest";
import type { Tier } from "../../src/quota/caps.js";

/**
 * The `demo-` prefix is load-bearing. It puts the emulator suite in fully
 * offline mode: no GCP credentials are consulted and no request can escape to
 * the real fitnesschronicle-d9080 project, whatever a test does wrong.
 */
export const PROJECT_ID = "demo-hercule";

/** Must match REGION in src/index.ts, or httpsCallable resolves the wrong URL. */
export const REGION = "europe-west2";

// Ports come from the "emulators" block in firebase.json.
const EMULATOR_HOST = "127.0.0.1";
const AUTH_PORT = 9099;
const FUNCTIONS_PORT = 5001;

/** Emulator-only. The auth emulator does not check password strength. */
const TEST_PASSWORD = "emulator-only-password";

/**
 * Refuse to run outside the emulator.
 *
 * `npm run test:integration` goes through `firebase emulators:exec`, which
 * sets this variable. Running `vitest run test/integration` by hand does not —
 * and without it the Admin SDK below would happily seed and delete documents
 * in the real project. Failing loudly here is much cheaper than finding out.
 */
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is unset — refusing to run. Use `npm run test:integration`, " +
      "which boots the emulators; running vitest directly would point the Admin SDK at production.",
  );
}

// Unique app names so a file that imports this twice, or a re-import after a
// worker restart, never collides with an already-initialised app.
const instanceId = randomUUID();

const clientApp = initializeApp(
  // The auth emulator accepts any apiKey, but the SDK refuses to start without
  // one present.
  { projectId: PROJECT_ID, apiKey: "fake-api-key" },
  `test-client-${instanceId}`,
);

const auth = getAuth(clientApp);
connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_PORT}`, {
  disableWarnings: true,
});

const functions = getFunctions(clientApp, REGION);
connectFunctionsEmulator(functions, EMULATOR_HOST, FUNCTIONS_PORT);

const adminApp = initializeAdminApp(
  { projectId: PROJECT_ID },
  `test-admin-${instanceId}`,
);

/** Admin access, for seeding and inspecting aiUsage/{uid} directly. */
export const adminDb = getFirestore(adminApp);

const usageDoc = (uid: string) => adminDb.collection("aiUsage").doc(uid);

const userDoc = (uid: string) => adminDb.collection("users").doc(uid);

/**
 * Writes users/{uid}.aiCoachConsent directly into the emulator.
 *
 * Kept separate from createTestUser's own write to it below so a test that
 * cares specifically about the consent gate — see aiCoachConsent.test.ts —
 * can set it to false or leave it unset without fighting a default.
 */
export const setAiCoachConsent = async (
  uid: string,
  granted: boolean,
): Promise<void> => {
  await userDoc(uid).set({ aiCoachConsent: granted }, { merge: true });
};

/**
 * Deletes a user from the auth emulator, the way production deletes one.
 *
 * Admin-side rather than through the signed-in client because the trigger is
 * what is under test, not the client SDK: onUserDeleted fires on the auth
 * deletion event itself, whichever side issues it. Going through admin also
 * keeps the test honest about the real ordering — the app deletes Firestore
 * data first and calls this last.
 */
export const deleteAuthUser = (uid: string): Promise<void> =>
  getAdminAuth(adminApp).deleteUser(uid);

export interface TestUser {
  uid: string;
  email: string;
}

/**
 * Creates a real user in the auth emulator and signs them in.
 *
 * The returned session gives the client SDK a genuine ID token, so callables
 * are exercised through the same verification path production uses.
 *
 * Grants AI coach consent by default. Every suite except
 * aiCoachConsent.test.ts is testing something further down the pipeline —
 * quota, rate limiting, request validation — and none of that is reachable
 * past requireAiCoachConsent otherwise. A test that specifically wants an
 * unconsented user calls setAiCoachConsent(uid, false) to override this.
 */
export const createTestUser = async (): Promise<TestUser> => {
  const email = `test-${randomUUID()}@example.com`;
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    TEST_PASSWORD,
  );

  await setAiCoachConsent(credential.user.uid, true);

  return { uid: credential.user.uid, email };
};

/** Leaves the client with no signed-in user, so calls carry no ID token. */
export const signOutTestUser = (): Promise<void> => signOut(auth);

export const callPing = (data?: unknown): Promise<unknown> =>
  httpsCallable(functions, "ping")(data);

export const callCoach = (data?: unknown): Promise<unknown> =>
  httpsCallable(functions, "chatWithCoach")(data);

export const callUsagePercentage = (): Promise<unknown> =>
  httpsCallable(functions, "getUsagePercentage")();

export interface UsageSeed {
  tokensUsed?: number;
  tier?: Tier;
  periodStart?: Date;
  rateTokens?: number;
  rateLastRefill?: number;
}

/**
 * Writes an aiUsage document straight into the emulator.
 *
 * periodStart defaults to now for a reason: a seed without it looks to
 * checkQuota like a brand-new period, which resets tokensUsed to 0 and
 * silently undoes whatever the test was setting up.
 */
export const seedUsage = async (
  uid: string,
  { periodStart, ...fields }: UsageSeed,
): Promise<void> => {
  await usageDoc(uid).set(
    {
      ...fields,
      periodStart: Timestamp.fromDate(periodStart ?? new Date()),
    },
    { merge: true },
  );
};

export const readUsage = async (
  uid: string,
): Promise<FirebaseFirestore.DocumentData | undefined> =>
  (await usageDoc(uid).get()).data();

/**
 * Third lock, and the one that sits closest to the danger.
 *
 * The other two — the FIRESTORE_EMULATOR_HOST check at the top of this file,
 * and the `--project demo-hercule` flag in the test:integration script — are
 * both far away from the delete, and both can be bypassed by editing one line
 * somewhere else. This one guards the destructive call itself.
 *
 * Note what randomUUID does NOT do here. It randomises test users' emails, so
 * seedUsage and readUsage can only ever touch a uid this run just created. But
 * clearUsage wipes the WHOLE aiUsage collection with no uid filter — pointed
 * at the real project it would delete every user's quota document, and no
 * amount of randomness in the test data would prevent that.
 */
const assertSafeToDelete = (): void => {
  const projectId = adminApp.options.projectId;

  if (!projectId?.startsWith("demo-")) {
    throw new Error(
      `Refusing to wipe aiUsage: connected project "${projectId}" is not a demo project. ` +
        "Only project ids starting with `demo-` are fake; anything else is real data.",
    );
  }
};

/** Wipes aiUsage between suites so one test's seed cannot leak into another. */
export const clearUsage = async (): Promise<void> => {
  assertSafeToDelete();

  const snapshot = await adminDb.collection("aiUsage").get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
};

export interface CallableFailure {
  /** e.g. "functions/unauthenticated". */
  code: string;
  /** Whatever the handler passed as HttpsError's third argument. */
  details: unknown;
}

/**
 * Runs a callable that is expected to fail, and returns its error.
 *
 * Throwing when the call *succeeds* is the important half: a rejection test
 * that silently passes because nothing was rejected is worse than no test.
 */
export const catchCallableError = async (
  run: () => Promise<unknown>,
): Promise<CallableFailure> => {
  try {
    await run();
  } catch (error: unknown) {
    const failure = error as { code?: string; details?: unknown };
    return { code: failure.code ?? "unknown", details: failure.details };
  }

  throw new Error("Expected the callable to reject, but it resolved.");
};

/** A payload that passes CoachRequestSchema, so tests can break one field at a time. */
export const validCoachRequest = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  message: "hello",
  history: [],
  // The server allows at most one day of drift from its own UTC date.
  today: new Date().toISOString().slice(0, 10),
  prefs: { repType: "fixed", measure: "kg" },
  ...overrides,
});

// Vitest isolates each test file, so this registers once per file rather than
// tearing the shared apps down after the first one.
afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  await deleteApp(clientApp);
  await deleteAdminApp(adminApp);
});
