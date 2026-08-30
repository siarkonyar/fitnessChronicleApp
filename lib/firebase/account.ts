import {
  deleteUser,
  getAuth,
  reauthenticateWithCredential,
} from "@react-native-firebase/auth";
import firestore, {
  type FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { logEvent } from "../analytics/client";
import { GOOGLE_PROVIDER_ID, getCredentialForUser } from "./credentials";

const SUBCOLLECTIONS = ["fitnessLogs", "exerciseNames", "labels"] as const;

const deleteSubcollection = async (
  userDocRef: FirebaseFirestoreTypes.DocumentReference,
  name: string,
): Promise<void> => {
  const snapshot = await userDocRef.collection(name).get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
};

/**
 * Permanently deletes the signed-in user's data and their auth account.
 *
 * The order matters more than it looks. Firebase refuses deleteUser unless the
 * token was minted minutes ago, and sessions persist across launches — so the
 * delete would reliably fail. It used to fail *after* the Firestore data had
 * already been wiped, leaving people with a surviving account and no data.
 * Proving identity first means a cancelled prompt costs nothing.
 */
export const deleteAccount = async (): Promise<void> => {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error("No user is currently signed in.");
  }

  // Read before the account is deleted, while providerData is still meaningful.
  const providerId = currentUser.providerData[0]?.providerId;

  // Prompts the user through their original provider. Throws if they cancel,
  // which aborts before anything irreversible happens.
  const credential = await getCredentialForUser(currentUser);
  await reauthenticateWithCredential(currentUser, credential);

  const userDocRef = firestore().collection("users").doc(currentUser.uid);

  // Has to run while still signed in: firestore.rules only lets a user touch
  // documents under their own uid, so nothing could be cleaned up afterwards.
  for (const name of SUBCOLLECTIONS) {
    await deleteSubcollection(userDocRef, name);
  }
  await userDocRef.delete();

  await deleteUser(currentUser);

  // Strictly after the delete. Revoking earlier tears down the very session
  // the delete depends on, and a failure here leaves nothing to recover.
  // Skipped entirely for Apple accounts, which were never signed into Google
  // and would only throw here.
  if (providerId === GOOGLE_PROVIDER_ID) {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (error) {
      console.warn("Google sign-out during account deletion failed:", error);
    }
  }

  // Fired last, once the account is actually gone. Paired with
  // account_delete_started it shows how many people begin this and stop.
  logEvent("account_deleted", {});
};
