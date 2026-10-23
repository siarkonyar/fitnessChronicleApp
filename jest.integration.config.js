/**
 * Integration tests: the app's real lib/ code against the Firebase emulators.
 *
 * Run with `npm run test:integration`, which boots Auth, Firestore and
 * Functions under the demo-hercule project. Running this config by hand
 * without the emulators fails fast in integration/support/emulator.ts.
 *
 * React Native Firebase cannot load in Node, so each native module is mapped
 * to a shim in integration/shims/ that implements the same API surface the
 * app uses (including RNFB v23's `exists()` method) on top of the Firebase JS
 * SDK. Everything above that line — lib/firebase, lib/ai, the Zod schemas,
 * firestore.rules, the Cloud Functions — is the real code.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/integration/**/*.integration.test.ts"],
  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  // firebase-admin/auth depends on jose, which ships ES modules only.
  transformIgnorePatterns: ["/node_modules/(?!jose/)"],
  globals: { __DEV__: false },
  moduleNameMapper: {
    "^@react-native-firebase/app$": "<rootDir>/integration/shims/app.ts",
    "^@react-native-firebase/auth$": "<rootDir>/integration/shims/auth.ts",
    "^@react-native-firebase/firestore$": "<rootDir>/integration/shims/firestore.ts",
    "^@react-native-firebase/functions$": "<rootDir>/integration/shims/functions.ts",
    "^@react-native-firebase/analytics$": "<rootDir>/integration/shims/nativeStubs.ts",
    "^expo-constants$": "<rootDir>/integration/shims/expoConstants.ts",
    "^posthog-react-native$": "<rootDir>/integration/shims/posthog.ts",
    "^@react-native-google-signin/google-signin$": "<rootDir>/integration/shims/nativeStubs.ts",
    "^@invertase/react-native-apple-authentication$": "<rootDir>/integration/shims/nativeStubs.ts",
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    // The Admin SDK is only installed for the server; reuse that copy for
    // seeding server-only documents and inspecting data past the rules.
    "^firebase-admin/(app|auth|firestore)$":
      "<rootDir>/functions/node_modules/firebase-admin/lib/$1/index.js",
    "^@/(.*)$": "<rootDir>/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  // One emulator, shared state: files must not run concurrently.
  maxWorkers: 1,
  testTimeout: 30_000,
};
