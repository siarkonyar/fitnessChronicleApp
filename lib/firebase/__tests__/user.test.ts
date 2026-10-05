import {
  getUserProfile,
  getUserSettings,
  updateUserProfile,
  updateUserSettings,
} from "../user";
import {
  TEST_UID,
  readDoc,
  resetFirestore,
  seedDoc,
} from "./firestoreTestUtils";

jest.mock("@react-native-firebase/firestore", () =>
  require("./firestoreTestUtils"),
);

const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
let mockCurrentUser: { uid: string; updateProfile: typeof mockUpdateProfile } | null = null;
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: mockCurrentUser }),
}));

const USER = ["users", TEST_UID];

beforeEach(() => {
  resetFirestore();
  mockUpdateProfile.mockClear();
  mockCurrentUser = { uid: TEST_UID, updateProfile: mockUpdateProfile };
});

describe("getUserSettings", () => {
  test("returns the stored settings", async () => {
    seedDoc(USER, {
      measure: "lbs",
      activeProgramId: "p1",
      activeProgramDay: 2,
      activeProgramDayDate: "2026-06-10",
      analyticsConsent: true,
    });

    expect(await getUserSettings()).toEqual({
      measure: "lbs",
      activeProgramId: "p1",
      activeProgramDay: 2,
      activeProgramDayDate: "2026-06-10",
      analyticsConsent: true,
    });
  });

  test("ignores profile and streak fields living on the same document", async () => {
    seedDoc(USER, { measure: "kg", name: "Sam", streakWeeks: 4 });

    expect(await getUserSettings()).toEqual({ measure: "kg" });
  });

  test("writes and returns kg for a brand-new user", async () => {
    expect(await getUserSettings()).toEqual({ measure: "kg" });
    expect(readDoc(USER)).toEqual({ measure: "kg" });
  });

  test("repairs an unknown unit to kg without losing other fields", async () => {
    seedDoc(USER, { measure: "stone", name: "Sam", streakWeeks: 4 });

    expect(await getUserSettings()).toEqual({ measure: "kg" });
    expect(readDoc(USER)).toEqual({ measure: "kg", name: "Sam", streakWeeks: 4 });
  });

  // KNOWN BUG: one corrupt optional field fails the whole parse, and the
  // fallback then overwrites a valid "lbs" preference with "kg".
  test.failing("keeps a valid unit when an unrelated setting is corrupt", async () => {
    seedDoc(USER, { measure: "lbs", activeProgramDay: -1 });

    await getUserSettings();

    expect(readDoc(USER)?.measure).toBe("lbs");
  });

  test("requires a signed-in user", async () => {
    mockCurrentUser = null;

    await expect(getUserSettings()).rejects.toThrow("User not authenticated");
  });
});

describe("updateUserSettings", () => {
  test("merges the changed fields into the user document", async () => {
    seedDoc(USER, { measure: "kg", name: "Sam" });

    await updateUserSettings({ activeProgramId: "p1", activeProgramDay: 0 });

    expect(readDoc(USER)).toEqual({
      measure: "kg",
      name: "Sam",
      activeProgramId: "p1",
      activeProgramDay: 0,
    });
  });

  test("skips undefined fields instead of crashing the native write", async () => {
    await updateUserSettings({ measure: "lbs", activeProgramId: undefined });

    expect(readDoc(USER)).toEqual({ measure: "lbs" });
  });

  test("keeps falsy-but-meaningful values: false, 0 and the empty string", async () => {
    // "" is how removeProgramSelection clears the active program.
    await updateUserSettings({
      analyticsConsent: false,
      activeProgramDay: 0,
      activeProgramId: "",
    });

    expect(readDoc(USER)).toEqual({
      analyticsConsent: false,
      activeProgramDay: 0,
      activeProgramId: "",
    });
  });

  test("drops keys that are not settings", async () => {
    await updateUserSettings({
      measure: "kg",
      streakWeeks: 999,
      tier: "max",
    } as unknown as Parameters<typeof updateUserSettings>[0]);

    expect(readDoc(USER)).toEqual({ measure: "kg" });
  });

  test("writes an empty merge for an empty update", async () => {
    seedDoc(USER, { measure: "lbs" });

    await updateUserSettings({});

    expect(readDoc(USER)).toEqual({ measure: "lbs" });
  });
});

describe("getUserProfile", () => {
  test("returns the stored profile", async () => {
    seedDoc(USER, { name: "Sam", birthday: "2000-02-29", gender: "non_binary" });

    expect(await getUserProfile()).toEqual({
      name: "Sam",
      birthday: "2000-02-29",
      gender: "non_binary",
    });
  });

  test("returns an empty profile for a new user", async () => {
    expect(await getUserProfile()).toEqual({});
  });

  test("discards the whole profile when the birthday is not a real date", async () => {
    // The name is valid but is not returned either, which sends the user
    // back through onboarding.
    seedDoc(USER, { name: "Sam", gender: "male", birthday: "2023-02-29" });

    expect(await getUserProfile()).toEqual({});
  });

  test("discards a profile with an unknown gender value", async () => {
    seedDoc(USER, { name: "Sam", gender: "other" });

    expect(await getUserProfile()).toEqual({});
  });
});

describe("updateUserProfile", () => {
  test("saves the profile and mirrors the name onto the auth account", async () => {
    await updateUserProfile({ name: "Sam", birthday: "2000-01-31", gender: "female" });

    expect(readDoc(USER)).toEqual({ name: "Sam", birthday: "2000-01-31", gender: "female" });
    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: "Sam" });
  });

  test("leaves the auth display name alone when the name is not changing", async () => {
    await updateUserProfile({ gender: "male" });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(readDoc(USER)).toEqual({ gender: "male" });
  });

  test("clears the display name with null, not an empty string", async () => {
    await updateUserProfile({ name: "" });

    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: null });
  });

  test("keeps unrelated settings on the same document", async () => {
    seedDoc(USER, { measure: "lbs", analyticsConsent: true });

    await updateUserProfile({ name: "Sam" });

    expect(readDoc(USER)).toEqual({ measure: "lbs", analyticsConsent: true, name: "Sam" });
  });

  test("fails when the auth profile update fails, after the Firestore write", async () => {
    // The two writes run in parallel: the document is already saved when the
    // auth update rejects, so the call fails with the profile half-applied.
    mockUpdateProfile.mockRejectedValueOnce(new Error("auth/network-request-failed"));

    await expect(updateUserProfile({ name: "Sam" })).rejects.toThrow(
      "auth/network-request-failed",
    );
    expect(readDoc(USER)).toEqual({ name: "Sam" });
  });
});
