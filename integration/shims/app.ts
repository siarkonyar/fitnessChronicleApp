/**
 * Stand-in for @react-native-firebase/app: one Firebase JS SDK app, pointed
 * at the emulators by the sibling shims.
 *
 * The `demo-` project id is load-bearing: it puts the emulator suite in
 * offline mode, so no request can reach the real project whatever a test does.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

export const PROJECT_ID = "demo-hercule";
export const EMULATOR_HOST = "127.0.0.1";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is unset — refusing to run. Use `npm run test:integration`, " +
      "which boots the emulators first.",
  );
}

export const firebaseApp: FirebaseApp =
  getApps()[0] ??
  // The auth emulator accepts any apiKey, but the SDK refuses to start without one.
  initializeApp({ projectId: PROJECT_ID, apiKey: "fake-api-key" });

export const getApp = (): FirebaseApp => firebaseApp;

export default { app: getApp };
