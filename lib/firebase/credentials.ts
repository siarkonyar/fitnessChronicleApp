import { appleAuth } from "@invertase/react-native-apple-authentication";
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

export const GOOGLE_PROVIDER_ID = "google.com";
export const APPLE_PROVIDER_ID = "apple.com";

// Configured here rather than in the sign-in screen because reauthentication
// needs Google too, and that runs for users who never mount the sign-in screen
// in this launch. Configuring next to both callers keeps them working no
// matter which one runs first.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
});

export const getGoogleCredential =
  async (): Promise<FirebaseAuthTypes.AuthCredential> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    if (!idToken) {
      throw new Error("No ID token found");
    }

    return GoogleAuthProvider.credential(idToken);
  };

export const getAppleCredential =
  async (): Promise<FirebaseAuthTypes.AuthCredential> => {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      // Per react-native-apple-authentication's FAQ, the name must come first.
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });

    if (!response.identityToken) {
      throw new Error("Apple Sign-In failed - no identity token returned");
    }

    return AppleAuthProvider.credential(response.identityToken, response.nonce);
  };

/**
 * Builds a fresh credential using whichever provider the account was created
 * with, prompting the user. Used to prove identity again before an operation
 * Firebase considers sensitive.
 */
export const getCredentialForUser = async (
  user: FirebaseAuthTypes.User,
): Promise<FirebaseAuthTypes.AuthCredential> => {
  const providerId = user.providerData[0]?.providerId;

  if (providerId === APPLE_PROVIDER_ID) return getAppleCredential();
  if (providerId === GOOGLE_PROVIDER_ID) return getGoogleCredential();

  throw new Error(
    `Cannot reauthenticate an account from provider: ${providerId ?? "unknown"}`,
  );
};
