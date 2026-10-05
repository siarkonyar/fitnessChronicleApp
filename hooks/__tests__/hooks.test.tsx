/** The small hooks: tier badge, analytics consent sync, screen tracking, theme colour. */
import { renderHook, waitFor } from "@testing-library/react-native";
import { Colors } from "@/constants/Colors";
import { useAnalyticsConsent } from "../useAnalyticsConsent";
import { useScreenTracking } from "../useScreenTracking";
import { useSubscriptionTier } from "../useSubscriptionTier";
import { useThemeColor } from "../useThemeColor";
import { createTestQueryClient, queryWrapper } from "./queryWrapper";

const mockCallAiUsage = jest.fn();
const mockSetUserId = jest.fn();
const mockSetCollectionEnabled = jest.fn();
const mockLogScreenView = jest.fn();
const mockApplyStoredConsent = jest.fn();
let mockUser: { uid: string } | null = null;
let mockPathname: string | null = "/";
let mockScheme: "light" | "dark" | null = "light";

jest.mock("@/lib/ai/coachServer", () => ({
  callAiUsage: () => mockCallAiUsage(),
}));

jest.mock("@/lib/analytics/client", () => ({
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setCollectionEnabled: (...args: unknown[]) => mockSetCollectionEnabled(...args),
  logScreenView: (...args: unknown[]) => mockLogScreenView(...args),
}));

jest.mock("@/lib/analytics/consent", () => ({
  applyStoredConsent: (...args: unknown[]) => mockApplyStoredConsent(...args),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("@/hooks/useColorScheme", () => ({
  useColorScheme: () => mockScheme,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
  mockPathname = "/";
  mockScheme = "light";
  mockApplyStoredConsent.mockResolvedValue(undefined);
});

describe("useSubscriptionTier", () => {
  const renderTier = (client = createTestQueryClient()) =>
    renderHook(() => useSubscriptionTier(), { wrapper: queryWrapper(client) });

  test("reports the tier the server sent", async () => {
    mockCallAiUsage.mockResolvedValue({ percentUsed: 1, resetsAt: null, tier: "max" });
    const { result } = renderTier();

    await waitFor(() => expect(result.current).toBe("max"));
  });

  test("is free while loading, so nobody briefly sees a paid badge", () => {
    mockCallAiUsage.mockReturnValue(new Promise(() => undefined));

    expect(renderTier().result.current).toBe("free");
  });

  test("is free when the usage request fails", async () => {
    mockCallAiUsage.mockRejectedValue(new Error("offline"));
    const { result } = renderTier();

    await waitFor(() => expect(mockCallAiUsage).toHaveBeenCalled());
    expect(result.current).toBe("free");
  });

  test("is free for a bare number left in the cache by an old build", () => {
    const client = createTestQueryClient();
    client.setQueryData(["aiUsage"], 77);
    mockCallAiUsage.mockReturnValue(new Promise(() => undefined));

    expect(renderTier(client).result.current).toBe("free");
  });
});

describe("useAnalyticsConsent", () => {
  test("switches collection off and clears the id when nobody is signed in", () => {
    renderHook(() => useAnalyticsConsent());

    expect(mockSetUserId).toHaveBeenCalledWith(null);
    expect(mockSetCollectionEnabled).toHaveBeenCalledWith(false);
    expect(mockApplyStoredConsent).not.toHaveBeenCalled();
  });

  test("tags events with the uid and applies that user's stored choice", () => {
    mockUser = { uid: "uid-1" };

    renderHook(() => useAnalyticsConsent());

    expect(mockSetUserId).toHaveBeenCalledWith("uid-1");
    expect(mockApplyStoredConsent).toHaveBeenCalledTimes(1);
    expect(mockSetCollectionEnabled).toHaveBeenCalledWith(false);
  });

  test("on sign-out, stops collecting before the next person signs in", () => {
    mockUser = { uid: "uid-1" };
    const { rerender } = renderHook(() => useAnalyticsConsent());

    mockUser = null;
    rerender({});

    expect(mockSetUserId).toHaveBeenLastCalledWith(null);
    expect(mockSetCollectionEnabled).toHaveBeenLastCalledWith(false);
  });

  test("re-reads consent when a different user signs in on the same device", () => {
    mockUser = { uid: "uid-1" };
    const { rerender } = renderHook(() => useAnalyticsConsent());

    mockUser = { uid: "uid-2" };
    rerender({});

    expect(mockSetUserId).toHaveBeenLastCalledWith("uid-2");
    expect(mockApplyStoredConsent).toHaveBeenCalledTimes(2);
  });

  test("does not re-run for a new user object with the same uid", () => {
    mockUser = { uid: "uid-1" };
    const { rerender } = renderHook(() => useAnalyticsConsent());

    mockUser = { uid: "uid-1" };
    rerender({});

    expect(mockApplyStoredConsent).toHaveBeenCalledTimes(1);
  });

  test("survives a failure to read the stored choice", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockApplyStoredConsent.mockRejectedValue(new Error("offline"));
    mockUser = { uid: "uid-1" };

    renderHook(() => useAnalyticsConsent());

    await waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});

describe("useScreenTracking", () => {
  test("reports each route once", () => {
    mockPathname = "/(tabs)";
    const { rerender } = renderHook(() => useScreenTracking());

    rerender({});
    mockPathname = "/settings";
    rerender({});

    expect(mockLogScreenView.mock.calls).toEqual([["/(tabs)"], ["/settings"]]);
  });

  test("reports nothing before the router knows the route", () => {
    mockPathname = "";

    renderHook(() => useScreenTracking());

    expect(mockLogScreenView).not.toHaveBeenCalled();
  });

  test("reports a return to an earlier route again", () => {
    mockPathname = "/a";
    const { rerender } = renderHook(() => useScreenTracking());
    mockPathname = "/b";
    rerender({});
    mockPathname = "/a";
    rerender({});

    expect(mockLogScreenView).toHaveBeenCalledTimes(3);
  });
});

describe("useThemeColor", () => {
  test("prefers the colour passed for the current theme", () => {
    mockScheme = "dark";

    const { result } = renderHook(() => useThemeColor({ light: "#fff", dark: "#000" }, "text"));

    expect(result.current).toBe("#000");
  });

  test("falls back to the theme token when no override is given", () => {
    mockScheme = "dark";

    const { result } = renderHook(() => useThemeColor({ light: "#fff" }, "text"));

    expect(result.current).toBe(Colors.dark.text);
  });

  test("uses the light theme when the system reports no scheme", () => {
    mockScheme = null;

    const { result } = renderHook(() => useThemeColor({}, "background"));

    expect(result.current).toBe(Colors.light.background);
  });
});
