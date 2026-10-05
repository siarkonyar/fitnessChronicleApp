/**
 * Stand-in for @react-native-firebase/auth over the JS SDK and the Auth
 * emulator.
 *
 * Covers both shapes the app uses: the namespaced `auth().currentUser` (with
 * RNFB's method-style `user.updateProfile(...)`) and the modular `getAuth`,
 * `deleteUser`, `reauthenticateWithCredential`, `onAuthStateChanged`,
 * `signOut`.
 */
import * as jsAuth from "firebase/auth";
import { EMULATOR_HOST, firebaseApp } from "./app";

const AUTH_PORT = 9099;

export const jsAuthInstance = jsAuth.getAuth(firebaseApp);
jsAuth.connectAuthEmulator(jsAuthInstance, `http://${EMULATOR_HOST}:${AUTH_PORT}`, {
  disableWarnings: true,
});

/** RNFB's User: the JS SDK's free functions exposed as methods. */
export class RnfbUser {
  constructor(readonly js: jsAuth.User) {}

  get uid(): string {
    return this.js.uid;
  }
  get email(): string | null {
    return this.js.email;
  }
  get displayName(): string | null {
    return this.js.displayName;
  }
  get providerData(): jsAuth.UserInfo[] {
    return this.js.providerData;
  }
  updateProfile(profile: { displayName?: string | null; photoURL?: string | null }) {
    // RNFB clears the name with null. The JS SDK sends null as-is, which the
    // Auth emulator rejects ("displayName must be string"); "" clears it too.
    const displayName = profile.displayName === null ? "" : profile.displayName;
    return jsAuth.updateProfile(this.js, { ...profile, displayName });
  }
  reload(): Promise<void> {
    return this.js.reload();
  }
  getIdToken(forceRefresh?: boolean): Promise<string> {
    return this.js.getIdToken(forceRefresh);
  }
}

const wrap = (user: jsAuth.User | null): RnfbUser | null => (user ? new RnfbUser(user) : null);
const unwrap = (user: RnfbUser | jsAuth.User): jsAuth.User =>
  user instanceof RnfbUser ? user.js : user;

const authModule = {
  get currentUser(): RnfbUser | null {
    return wrap(jsAuthInstance.currentUser);
  },
};

export const getAuth = () => authModule;

export const deleteUser = (user: RnfbUser) => jsAuth.deleteUser(unwrap(user));

export const reauthenticateWithCredential = (user: RnfbUser, credential: jsAuth.AuthCredential) =>
  jsAuth.reauthenticateWithCredential(unwrap(user), credential);

export const onAuthStateChanged = (
  _auth: unknown,
  listener: (user: RnfbUser | null) => void,
) => jsAuth.onAuthStateChanged(jsAuthInstance, (user) => listener(wrap(user)));

export const signOut = () => jsAuth.signOut(jsAuthInstance);

export const GoogleAuthProvider = jsAuth.GoogleAuthProvider;

export const AppleAuthProvider = {
  credential: (idToken: string, rawNonce?: string) =>
    new jsAuth.OAuthProvider("apple.com").credential({ idToken, rawNonce }),
};

const auth = Object.assign(() => authModule, { GoogleAuthProvider, AppleAuthProvider });

export default auth;
