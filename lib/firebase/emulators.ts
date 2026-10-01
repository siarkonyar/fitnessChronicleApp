import { FUNCTIONS_REGION } from "@/constants/firebase";
import { getApp } from "@react-native-firebase/app";
import { connectAuthEmulator, getAuth } from "@react-native-firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "@react-native-firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "@react-native-firebase/functions";
import Constants from "expo-constants";

// Must match the "emulators" block in firebase.json.
const AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_PORT = 8080;
const FUNCTIONS_EMULATOR_PORT = 5001;

/**
 * DEV ONLY: point Auth, Firestore and Functions at the local emulators instead
 * of the live project, to try changes without deploying. `npm run dev:emu`
 * starts the emulators and runs Expo with EXPO_PUBLIC_USE_EMULATORS=true;
 * plain `npm start` stays live. __DEV__ is false in release builds, so the
 * flag can never reach TestFlight or the App Store.
 */
export const isUsingEmulators =
  __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === "true";

/**
 * The Mac Metro is served from. On a physical phone localhost is the phone
 * itself, so the emulators have to be reached through the Mac's address; the
 * same address also works in the simulator.
 */
const emulatorHost = (): string =>
  Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";

// Runs once, at import. Imported first in app/_layout.tsx because the SDKs
// only accept an emulator before their first request.
if (isUsingEmulators) {
  const host = emulatorHost();

  connectAuthEmulator(getAuth(), `http://${host}:${AUTH_EMULATOR_PORT}`);
  connectFirestoreEmulator(getFirestore(), host, FIRESTORE_EMULATOR_PORT);
  // Each region is its own Functions instance, so connect the one the
  // callables use.
  connectFunctionsEmulator(
    getFunctions(getApp(), FUNCTIONS_REGION),
    host,
    FUNCTIONS_EMULATOR_PORT,
  );
}
