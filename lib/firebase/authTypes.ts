import type { getAuth, signInWithCredential } from "@react-native-firebase/auth";

/**
 * Auth types named without the FirebaseAuthTypes namespace, which React
 * Native Firebase 26 removes. Version 23 exports them only through that
 * namespace, so they are read off the modular functions instead, which works
 * on both versions.
 */

/** A signed-in user. */
export type User = NonNullable<ReturnType<typeof getAuth>["currentUser"]>;

/** What a sign-in resolves with. */
export type UserCredential = Awaited<ReturnType<typeof signInWithCredential>>;

/** A provider credential, as passed to a sign-in or reauthentication. */
export type AuthCredential = Parameters<typeof signInWithCredential>[1];
