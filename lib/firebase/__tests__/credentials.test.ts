import {
  APPLE_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
  getAppleCredential,
  getCredentialForUser,
  getGoogleCredential,
} from "../credentials";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { User } from "../authTypes";

const mockGoogleSignIn = jest.fn();
const mockHasPlayServices = jest.fn();
const mockAppleRequest = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
  },
}));

jest.mock("@invertase/react-native-apple-authentication", () => ({
  appleAuth: {
    Operation: { LOGIN: 1 },
    Scope: { FULL_NAME: 0, EMAIL: 1 },
    performRequest: (...args: unknown[]) => mockAppleRequest(...args),
  },
}));

jest.mock("@react-native-firebase/auth", () => ({
  GoogleAuthProvider: {
    credential: (idToken: string) => ({ providerId: "google.com", idToken }),
  },
  AppleAuthProvider: {
    credential: (token: string, nonce?: string) => ({
      providerId: "apple.com",
      token,
      nonce,
    }),
  },
}));

const userFrom = (providerId?: string) =>
  ({
    providerData: providerId ? [{ providerId }] : [],
  }) as unknown as User;

// Captured once: configure() runs at import time, before any beforeEach.
const configureCalls = (GoogleSignin.configure as jest.Mock).mock.calls;

beforeEach(() => {
  mockGoogleSignIn.mockReset();
  mockHasPlayServices.mockReset().mockResolvedValue(true);
  mockAppleRequest.mockReset();
});

test("configures Google sign-in once, as soon as the module loads", () => {
  expect(configureCalls).toHaveLength(1);
  expect(configureCalls[0][0]).toHaveProperty("webClientId");
});

describe("getGoogleCredential", () => {
  test("builds a Firebase credential from the Google ID token", async () => {
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: "google-token" } });

    expect(await getGoogleCredential()).toEqual({
      providerId: "google.com",
      idToken: "google-token",
    });
    expect(mockHasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  });

  test("fails when Google returns no ID token", async () => {
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: null } });

    await expect(getGoogleCredential()).rejects.toThrow("No ID token found");
  });

  test("fails when the sign-in was cancelled and no data came back", async () => {
    mockGoogleSignIn.mockResolvedValue({ type: "cancelled", data: null });

    await expect(getGoogleCredential()).rejects.toThrow("No ID token found");
  });

  test("does not open the Google prompt when Play Services are missing", async () => {
    mockHasPlayServices.mockRejectedValue(new Error("PLAY_SERVICES_NOT_AVAILABLE"));

    await expect(getGoogleCredential()).rejects.toThrow("PLAY_SERVICES_NOT_AVAILABLE");
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });
});

describe("getAppleCredential", () => {
  test("asks for the name before the email, then passes the nonce through", async () => {
    mockAppleRequest.mockResolvedValue({ identityToken: "apple-token", nonce: "n-1" });

    expect(await getAppleCredential()).toEqual({
      providerId: "apple.com",
      token: "apple-token",
      nonce: "n-1",
    });
    expect(mockAppleRequest).toHaveBeenCalledWith({
      requestedOperation: 1,
      requestedScopes: [0, 1],
    });
  });

  test("fails when Apple returns no identity token", async () => {
    mockAppleRequest.mockResolvedValue({ identityToken: null, nonce: "n-1" });

    await expect(getAppleCredential()).rejects.toThrow(
      "Apple Sign-In failed - no identity token returned",
    );
  });
});

describe("getCredentialForUser", () => {
  test("reauthenticates an Apple account through Apple", async () => {
    mockAppleRequest.mockResolvedValue({ identityToken: "apple-token", nonce: "n" });

    const credential = await getCredentialForUser(userFrom(APPLE_PROVIDER_ID));

    expect(credential).toMatchObject({ providerId: "apple.com" });
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });

  test("reauthenticates a Google account through Google", async () => {
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: "google-token" } });

    const credential = await getCredentialForUser(userFrom(GOOGLE_PROVIDER_ID));

    expect(credential).toMatchObject({ providerId: "google.com" });
    expect(mockAppleRequest).not.toHaveBeenCalled();
  });

  test("names the unsupported provider in the error", async () => {
    await expect(getCredentialForUser(userFrom("password"))).rejects.toThrow(
      "Cannot reauthenticate an account from provider: password",
    );
  });

  test("reports an account with no provider as unknown", async () => {
    await expect(getCredentialForUser(userFrom())).rejects.toThrow(
      "Cannot reauthenticate an account from provider: unknown",
    );
  });

  test("uses the first linked provider when an account has several", async () => {
    mockAppleRequest.mockResolvedValue({ identityToken: "apple-token", nonce: "n" });
    const user = {
      providerData: [{ providerId: APPLE_PROVIDER_ID }, { providerId: GOOGLE_PROVIDER_ID }],
    } as unknown as User;

    await getCredentialForUser(user);

    expect(mockAppleRequest).toHaveBeenCalledTimes(1);
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });
});
