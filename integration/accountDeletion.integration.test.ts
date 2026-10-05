/**
 * deleteAccount end to end: real reauthentication, real Firestore deletes,
 * the real Auth deletion, and the onUserDeleted trigger cleaning up the
 * server-only documents a client can never touch.
 *
 * Reauthentication normally prompts Google or Apple. Here the credential
 * comes from the Auth emulator's email/password provider instead; everything
 * after the prompt is the app's real code.
 */
import { addExerciseLog } from "@/lib/firebase/exercise";
import { deleteAccount } from "@/lib/firebase/account";
import { addLabel, asignLabelToDay, getAllLabels } from "@/lib/firebase/label";
import { addProgram } from "@/lib/firebase/program";
import { updateUserProfile, updateUserSettings } from "@/lib/firebase/user";
import { addWeightLog } from "@/lib/firebase/weight";
import { makeLabel, makeLog } from "@/lib/firebase/__tests__/fixtures";
import { clearRecordedEvents, recordedEvents } from "./shims/nativeStubs";
import {
  adminAuth,
  adminDb,
  caught,
  pathsUnderUser,
  readAsAdmin,
  signInAs,
  signOutUser,
  signUpNewUser,
  waitFor,
  type TestUser,
} from "./support/emulator";

let mockReauthPassword = "emulator-only-password";

jest.mock("@/lib/firebase/credentials", () => {
  const { EmailAuthProvider } = require("firebase/auth");
  return {
    GOOGLE_PROVIDER_ID: "google.com",
    APPLE_PROVIDER_ID: "apple.com",
    getCredentialForUser: async (user: { email: string }) =>
      EmailAuthProvider.credential(user.email, mockReauthPassword),
  };
});

/** Fills every subcollection the app writes, through the app's own code. */
const populateEverything = async () => {
  await updateUserSettings({ measure: "kg", analyticsConsent: true });
  await updateUserProfile({ name: "Sam", gender: "female" });
  await addExerciseLog(makeLog());
  await addLabel(makeLabel());
  const [label] = await getAllLabels();
  await asignLabelToDay({ date: "2026-06-01", labelId: label.id });
  await addProgram("PPL", [{ isRestDay: true }]);
  await addWeightLog(80);
};

const authUserExists = async (uid: string) =>
  adminAuth.getUser(uid).then(
    () => true,
    () => false,
  );

let user: TestUser;

beforeEach(async () => {
  mockReauthPassword = "emulator-only-password";
  clearRecordedEvents();
  user = await signUpNewUser();
});

test("the populated account really does touch every subcollection", async () => {
  // Guards the next test: deleting an account that never had data proves nothing.
  await populateEverything();

  const collections = new Set((await pathsUnderUser(user.uid)).map((path) => path.split("/")[2]).filter(Boolean));
  expect([...collections].sort()).toEqual([
    "dayAssignments",
    "exerciseNames",
    "fitnessLogs",
    "labels",
    "programs",
    "weightLogs",
  ]);
});

test("removes every document, the Auth account, and the server-only usage record", async () => {
  await populateEverything();
  expect(await waitFor(async () => (await readAsAdmin(`aiUsage/${user.uid}`)) !== undefined)).toBe(true);

  await deleteAccount();

  expect(await pathsUnderUser(user.uid)).toEqual([]);
  expect(await authUserExists(user.uid)).toBe(false);
  expect(await waitFor(async () => (await readAsAdmin(`aiUsage/${user.uid}`)) === undefined)).toBe(true);
  expect(recordedEvents.map((event) => event.name)).toContain("account_deleted");
});

test("keeps the consent audit trail after the account is gone", async () => {
  // Pinned: onUserDeleted removes aiUsage and the RevenueCat customer, not
  // consentEvents. Whether a deleted user's consent history must be kept or
  // erased is a policy decision; this test makes the current answer explicit.
  await updateUserSettings({ analyticsConsent: true });
  const consentFor = () => adminDb.collection("consentEvents").where("uid", "==", user.uid).get();
  expect(await waitFor(async () => (await consentFor()).size === 1)).toBe(true);

  await deleteAccount();

  expect((await consentFor()).size).toBe(1);
});

test("a failed reauthentication deletes nothing at all", async () => {
  await populateEverything();
  const before = await pathsUnderUser(user.uid);
  mockReauthPassword = "wrong-password";

  const error = await caught(() => deleteAccount());

  expect(error.code).toMatch(/^auth\//);
  expect(await pathsUnderUser(user.uid)).toEqual(before);
  expect(await authUserExists(user.uid)).toBe(true);
  expect(recordedEvents.map((event) => event.name)).not.toContain("account_deleted");
});

test("leaves other accounts untouched", async () => {
  const other = user;
  await populateEverything();
  const otherPaths = await pathsUnderUser(other.uid);
  user = await signUpNewUser();
  await populateEverything();

  await deleteAccount();

  expect(await pathsUnderUser(other.uid)).toEqual(otherPaths);
  expect(await authUserExists(other.uid)).toBe(true);
  await signInAs(other);
});

test("refuses to run with nobody signed in", async () => {
  await signOutUser();

  await expect(deleteAccount()).rejects.toThrow("No user is currently signed in.");
});

test("data in a subcollection the app does not know about survives deletion", async () => {
  // Why lib/firebase/__tests__/account.subcollections.test.ts exists: the
  // deletion list is the only thing that decides what gets erased.
  const firestore = require("@react-native-firebase/firestore").default;
  await firestore().collection("users").doc(user.uid).collection("notes").add({ text: "left behind" });

  await deleteAccount();

  expect(await pathsUnderUser(user.uid)).toEqual([
    expect.stringMatching(new RegExp(`^users/${user.uid}/notes/`)),
  ]);
});
