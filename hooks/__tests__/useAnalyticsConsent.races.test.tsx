import { act, renderHook } from "@testing-library/react-native";
import { useAnalyticsConsent } from "../useAnalyticsConsent";

const mockReadSettings = jest.fn();
const mockSetCollectionEnabled = jest.fn();
const mockSetUserId = jest.fn();
let mockUser: { uid: string } | null = null;

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/lib/firebase/user", () => ({ getUserSettings: () => mockReadSettings() }));
jest.mock("@/lib/analytics/client", () => ({
  setCollectionEnabled: (...args: unknown[]) => mockSetCollectionEnabled(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
}));

const deferredSettings = () => {
  let resolve!: (settings: { measure: string; analyticsConsent: boolean }) => void;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => { jest.clearAllMocks(); mockUser = { uid: "alice" }; });

test("a consent read resolving after sign-out cannot turn collection back on", async () => {
  const old = deferredSettings();
  mockReadSettings.mockReturnValue(old.promise);
  const { rerender } = renderHook(() => useAnalyticsConsent());
  mockUser = null;
  rerender({});
  await act(async () => { old.resolve({ measure: "kg", analyticsConsent: true }); await old.promise; });
  expect(mockSetCollectionEnabled).not.toHaveBeenCalledWith(true);
  expect(mockSetUserId).toHaveBeenLastCalledWith(null);
});

test("an old account's delayed opt-in cannot override the new account's opt-out", async () => {
  const old = deferredSettings();
  mockReadSettings.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ measure: "kg", analyticsConsent: false });
  const { rerender } = renderHook(() => useAnalyticsConsent());
  mockUser = { uid: "bob" };
  await act(async () => { rerender({}); });
  await act(async () => { old.resolve({ measure: "kg", analyticsConsent: true }); await old.promise; });
  expect(mockSetCollectionEnabled).not.toHaveBeenCalledWith(true);
  expect(mockSetUserId).toHaveBeenLastCalledWith("bob");
});

test("an unmounted consent reader cannot change collection", async () => {
  const old = deferredSettings();
  mockReadSettings.mockReturnValue(old.promise);
  const { unmount } = renderHook(() => useAnalyticsConsent());
  unmount();
  await act(async () => { old.resolve({ measure: "kg", analyticsConsent: true }); await old.promise; });
  expect(mockSetCollectionEnabled).not.toHaveBeenCalledWith(true);
});
