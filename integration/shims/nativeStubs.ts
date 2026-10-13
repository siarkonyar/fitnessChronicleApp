/**
 * Stand-ins for the native modules that have no emulator: Firebase Analytics,
 * Google Sign-In and Sign in with Apple. jest.integration.config.js maps all
 * three to this one file.
 *
 * Analytics records instead of sending, so a test can assert which events the
 * real app code fired. The sign-in providers refuse: integration tests sign in
 * through the Auth emulator with email and password instead, and anything that
 * reaches for a real provider prompt is a test bug worth failing loudly.
 */

export interface RecordedEvent {
  name: string;
  params?: Record<string, unknown>;
}

export const recordedEvents: RecordedEvent[] = [];
export const clearRecordedEvents = (): void => {
  recordedEvents.length = 0;
};

// ---- @react-native-firebase/analytics --------------------------------------
export const getAnalytics = () => ({});
export const logEvent = async (_analytics: unknown, name: string, params?: Record<string, unknown>) => {
  recordedEvents.push({ name, params });
};
export const setAnalyticsCollectionEnabled = async () => undefined;
export const setUserId = async () => undefined;
export const setUserProperty = async () => undefined;

// ---- @react-native-google-signin/google-signin -----------------------------
const noProviderPrompt = async (): Promise<never> => {
  throw new Error("Provider sign-in prompts are not available in integration tests.");
};

export const googleSignOutCalls = { revokeAccess: 0, signOut: 0 };

export const GoogleSignin = {
  configure: () => undefined,
  hasPlayServices: async () => true,
  signIn: noProviderPrompt,
  revokeAccess: async () => {
    googleSignOutCalls.revokeAccess += 1;
  },
  signOut: async () => {
    googleSignOutCalls.signOut += 1;
  },
};

// ---- @invertase/react-native-apple-authentication --------------------------
export const appleAuth = {
  Operation: { LOGIN: 1 },
  Scope: { FULL_NAME: 0, EMAIL: 1 },
  performRequest: noProviderPrompt,
};
