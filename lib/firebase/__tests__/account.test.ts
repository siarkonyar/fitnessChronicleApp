import { deleteAccount } from "../account";
import {
  TEST_UID,
  readDoc,
  resetFirestore,
  seedDoc,
} from "./firestoreTestUtils";

// Records the order of the irreversible steps, so a regression that moves data
// deletion back above reauthentication is caught rather than merely implied.
let mockCallOrder: string[] = [];

let mockCurrentUser: unknown = null;
const mockDeleteUser = jest.fn();
const mockReauthenticate = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockRevokeAccess = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockAppleRequest = jest.fn();

jest.mock("@react-native-firebase/firestore", () =>
  require("./firestoreTestUtils"),
);

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: mockCurrentUser }),
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
  reauthenticateWithCredential: (...args: unknown[]) =>
    mockReauthenticate(...args),
  GoogleAuthProvider: {
    credential: (idToken: string) => ({ provider: "google", idToken }),
  },
  AppleAuthProvider: {
    credential: (token: string, nonce?: string) => ({
      provider: "apple",
      token,
      nonce,
    }),
  },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
    revokeAccess: (...args: unknown[]) => mockRevokeAccess(...args),
    signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
  },
}));

jest.mock("@invertase/react-native-apple-authentication", () => ({
  appleAuth: {
    Operation: { LOGIN: 1 },
    Scope: { FULL_NAME: 0, EMAIL: 1 },
    performRequest: (...args: unknown[]) => mockAppleRequest(...args),
  },
}));

jest.mock("../../analytics/client", () => ({ logEvent: jest.fn() }));

const GOOGLE_USER = {
  uid: TEST_UID,
  providerData: [{ providerId: "google.com" }],
};

/**
 * One document in every subcollection deleteAccount is responsible for.
 *
 * A list rather than a run of seedDoc calls so that seeding, "nothing was
 * touched", and "everything is gone" all walk the same paths. Written out
 * separately, the assertions only ever checked the three subcollections
 * someone had remembered to seed — which is precisely how programs,
 * weightLogs and dayAssignments survived account deletion while a test named
 * "every subcollection" passed. Adding a subcollection to SUBCOLLECTIONS in
 * account.ts means adding a row here.
 */
const SUBCOLLECTION_DOCS: readonly {
  path: string[];
  data: Record<string, unknown>;
}[] = [
  {
    path: ["users", TEST_UID, "fitnessLogs", "log-1"],
    data: { activity: "Bench Press" },
  },
  {
    path: ["users", TEST_UID, "exerciseNames", "name-1"],
    data: { name: "Squat" },
  },
  { path: ["users", TEST_UID, "labels", "push"], data: { label: "P" } },
  {
    path: ["users", TEST_UID, "dayAssignments", "2026-01-05"],
    data: { date: "2026-01-05", labelId: "push" },
  },
  {
    path: ["users", TEST_UID, "programs", "ppl"],
    data: { name: "Push Pull Legs", days: [] },
  },
  {
    path: ["users", TEST_UID, "weightLogs", "2026-01-05"],
    data: { weight: 82.5, date: "2026-01-05", measure: "kg" },
  },
];

const seedUserData = () => {
  seedDoc(["users", TEST_UID], { measure: "kg", name: "Alex" });
  SUBCOLLECTION_DOCS.forEach(({ path, data }) => seedDoc(path, data));
};

const expectUserDataIntact = () => {
  expect(readDoc(["users", TEST_UID])).toBeDefined();
  SUBCOLLECTION_DOCS.forEach(({ path }) => expect(readDoc(path)).toBeDefined());
};

beforeEach(() => {
  resetFirestore();
  jest.clearAllMocks();
  mockCallOrder = [];
  mockCurrentUser = GOOGLE_USER;

  mockGoogleSignIn.mockImplementation(async () => {
    mockCallOrder.push("reauthenticate");
    return { data: { idToken: "fresh-id-token" } };
  });
  mockReauthenticate.mockResolvedValue(undefined);
  mockDeleteUser.mockImplementation(async () => {
    mockCallOrder.push("deleteUser");
  });
  mockRevokeAccess.mockImplementation(async () => {
    mockCallOrder.push("revokeGoogleAccess");
  });
  mockGoogleSignOut.mockResolvedValue(undefined);
});

describe("deleteAccount", () => {
  test("keeps every document when the user cancels reauthentication", async () => {
    // Arrange — the user dismisses the Google sheet, the common real-world case
    seedUserData();
    mockGoogleSignIn.mockRejectedValue(new Error("SIGN_IN_CANCELLED"));

    // Act
    await expect(deleteAccount()).rejects.toThrow();

    // Assert — nothing irreversible happened
    expectUserDataIntact();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockRevokeAccess).not.toHaveBeenCalled();
  });

  test("keeps every document when reauthentication itself is rejected", async () => {
    // Arrange — a stale/invalid credential is refused by Firebase
    seedUserData();
    mockReauthenticate.mockRejectedValue(new Error("auth/user-mismatch"));

    // Act
    await expect(deleteAccount()).rejects.toThrow();

    // Assert
    expectUserDataIntact();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("reauthenticates before deleting anything", async () => {
    // Arrange
    seedUserData();

    // Act
    await deleteAccount();

    // Assert — reauthentication is the first irreversible-adjacent step
    expect(mockCallOrder[0]).toBe("reauthenticate");
    expect(mockReauthenticate).toHaveBeenCalled();
  });

  test("removes the user document and every subcollection on success", async () => {
    // Arrange
    seedUserData();

    // Act
    await deleteAccount();

    // Assert — Firestore does not cascade, so each subcollection is checked on
    // its own. Deleting the parent user document proves nothing about them.
    expect(readDoc(["users", TEST_UID])).toBeUndefined();
    SUBCOLLECTION_DOCS.forEach(({ path }) =>
      expect(readDoc(path)).toBeUndefined(),
    );
    expect(mockDeleteUser).toHaveBeenCalled();
  });

  test("revokes Google access only after the auth user is deleted", async () => {
    // Arrange — revoking first would strip the credential the delete needs
    seedUserData();

    // Act
    await deleteAccount();

    // Assert
    expect(mockCallOrder.indexOf("deleteUser")).toBeLessThan(
      mockCallOrder.indexOf("revokeGoogleAccess"),
    );
  });

  test("reauthenticates through Apple and leaves Google untouched", async () => {
    // Arrange — an Apple account was never signed into Google, so revoking
    // there would only throw and log noise
    seedUserData();
    mockCurrentUser = {
      uid: TEST_UID,
      providerData: [{ providerId: "apple.com" }],
    };
    mockAppleRequest.mockImplementation(async () => {
      mockCallOrder.push("reauthenticate");
      return { identityToken: "apple-identity-token", nonce: "apple-nonce" };
    });

    // Act
    await deleteAccount();

    // Assert — deleted via the Apple prompt, with Google never involved
    expect(mockAppleRequest).toHaveBeenCalled();
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
    expect(mockRevokeAccess).not.toHaveBeenCalled();
    expect(mockGoogleSignOut).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalled();
    expect(readDoc(["users", TEST_UID])).toBeUndefined();
  });

  test("throws without touching data when nobody is signed in", async () => {
    // Arrange
    seedUserData();
    mockCurrentUser = null;

    // Act
    await expect(deleteAccount()).rejects.toThrow();

    // Assert
    expectUserDataIntact();
  });
});
