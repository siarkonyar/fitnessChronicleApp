import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { renderHookError } from "@/hooks/__tests__/renderHookError";
import { AuthProvider, useAuth } from "../AuthContext";

type Listener = (user: unknown) => void;

let mockListener: Listener | null = null;
const mockUnsubscribe = jest.fn();
const mockFirebaseSignOut = jest.fn();
const mockRevokeAccess = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockLogEvent = jest.fn();
const mockSetPostHogUser = jest.fn();
const mockDeleteAccount = jest.fn();
let mockCurrentUser: unknown = null;

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: mockCurrentUser }),
  onAuthStateChanged: (_auth: unknown, listener: Listener) => {
    mockListener = listener;
    return mockUnsubscribe;
  },
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    revokeAccess: () => mockRevokeAccess(),
    signOut: () => mockGoogleSignOut(),
  },
}));

jest.mock("@/lib/analytics/client", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

jest.mock("@/lib/analytics/posthog", () => ({
  setPostHogUser: (...args: unknown[]) => mockSetPostHogUser(...args),
}));

jest.mock("@/lib/firebase/account", () => ({
  deleteAccount: () => mockDeleteAccount(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  uid: "uid-1",
  getIdToken: jest.fn().mockResolvedValue("token"),
  reload: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderAuth = () => renderHook(() => useAuth(), { wrapper });

/** Fires the most recent auth listener, as Firebase would. */
const emit = (user: unknown) => act(() => mockListener?.(user));

beforeEach(() => {
  jest.clearAllMocks();
  mockListener = null;
  mockCurrentUser = null;
  mockFirebaseSignOut.mockResolvedValue(undefined);
  mockRevokeAccess.mockResolvedValue(undefined);
  mockGoogleSignOut.mockResolvedValue(undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("useAuth refuses to run outside the provider", async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);

  expect((await renderHookError(() => useAuth()))?.message).toContain("useAuth must be used within an AuthProvider");
});

describe("auth state", () => {
  test("is loading and signed out until Firebase reports", async () => {
    const { result } = await renderAuth();

    expect(result.current.authLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("becomes signed in when Firebase reports a user", async () => {
    const { result } = await renderAuth();

    await emit(fakeUser({ email: "member@example.com", displayName: "Member" }));

    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.uid).toBe("uid-1");
    expect(mockSetPostHogUser).toHaveBeenCalledWith("uid-1");
  });

  test("stops loading when Firebase reports nobody", async () => {
    const { result } = await renderAuth();

    await emit(null);

    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("follows a later sign-out and clears the PostHog user", async () => {
    const { result } = await renderAuth();
    await emit(fakeUser());

    await emit(null);

    expect(result.current.user).toBeNull();
    expect(mockSetPostHogUser).toHaveBeenLastCalledWith(null);
  });

  test("unsubscribes from Firebase on unmount", async () => {
    const { unmount } = await renderAuth();
    const before = mockUnsubscribe.mock.calls.length;

    await unmount();

    expect(mockUnsubscribe.mock.calls.length).toBe(before + 1);
  });
});

describe("signOut", () => {
  test("signs out of Google, then Firebase, then reports the logout", async () => {
    const order: string[] = [];
    mockRevokeAccess.mockImplementation(async () => order.push("revoke"));
    mockGoogleSignOut.mockImplementation(async () => order.push("google"));
    mockFirebaseSignOut.mockImplementation(async () => order.push("firebase"));
    mockLogEvent.mockImplementation(() => order.push("logout"));
    const { result } = await renderAuth();

    await act(() => result.current.signOut());

    expect(order).toEqual(["revoke", "google", "firebase", "logout"]);
  });

  test("still signs out of Firebase when Google sign-out fails (Apple users)", async () => {
    mockRevokeAccess.mockRejectedValue(new Error("SIGN_IN_REQUIRED"));
    const { result } = await renderAuth();

    await act(() => result.current.signOut());

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith("logout", {});
  });

  test("rethrows a Firebase sign-out failure and reports no logout", async () => {
    mockFirebaseSignOut.mockRejectedValue(new Error("auth/internal-error"));
    const { result } = await renderAuth();

    await expect(act(() => result.current.signOut())).rejects.toThrow("auth/internal-error");
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});

describe("tokens and refresh", () => {
  test("getIdToken is null while signed out", async () => {
    const { result } = await renderAuth();

    expect(await result.current.getIdToken()).toBeNull();
  });

  test("getIdToken forwards the force-refresh flag", async () => {
    const user = fakeUser();
    const { result } = await renderAuth();
    await emit(user);

    expect(await result.current.getIdToken(true)).toBe("token");
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  test("getIdToken turns a token failure into null", async () => {
    const user = fakeUser({ getIdToken: jest.fn().mockRejectedValue(new Error("expired")) });
    const { result } = await renderAuth();
    await emit(user);

    expect(await result.current.getIdToken()).toBeNull();
  });

  test("refreshUser reloads the current user and publishes the fresh copy", async () => {
    const reloaded = fakeUser({ displayName: "Sam" });
    mockCurrentUser = fakeUser({
      reload: jest.fn(async () => {
        mockCurrentUser = reloaded;
      }),
    });
    const { result } = await renderAuth();

    await act(() => result.current.refreshUser());

    await waitFor(() => expect(result.current.user).toBe(reloaded));
  });

  test("refreshUser does nothing while signed out", async () => {
    const { result } = await renderAuth();

    await act(() => result.current.refreshUser());

    expect(result.current.user).toBeNull();
  });

  test("exposes the account deletion flow", async () => {
    const { result } = await renderAuth();

    await act(() => result.current.deleteAccount());

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
