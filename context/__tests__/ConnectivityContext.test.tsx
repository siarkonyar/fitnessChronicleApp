import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { renderHookError } from "@/hooks/__tests__/renderHookError";
import { ConnectivityProvider, useConnectivity } from "../ConnectivityContext";

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null; type: string };
type Listener = (state: NetState) => void;

const mockFetch = jest.fn();
const mockUnsubscribe = jest.fn();
const mockLogEvent = jest.fn();
let mockListener: Listener | null = null;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockFetch(),
    addEventListener: (listener: Listener) => {
      mockListener = listener;
      return mockUnsubscribe;
    },
  },
}));

jest.mock("@/lib/analytics/client", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

const WIFI: NetState = { isConnected: true, isInternetReachable: true, type: "wifi" };
const NO_SIGNAL: NetState = { isConnected: false, isInternetReachable: false, type: "none" };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ConnectivityProvider>{children}</ConnectivityProvider>
);

const renderConnectivity = async () => {
  const rendered = await renderHook(() => useConnectivity(), { wrapper });
  await waitFor(() => expect(rendered.result.current.connectivityLoading).toBe(false));
  return rendered;
};

/** Delivers a NetInfo change event, as the native module would. */
const change = (state: NetState) => act(() => mockListener?.(state));

const offlineEvents = () =>
  mockLogEvent.mock.calls.filter(([name]) => name === "offline_mode_entered").length;

beforeEach(() => {
  jest.clearAllMocks();
  mockListener = null;
  mockFetch.mockResolvedValue(WIFI);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("useConnectivity refuses to run outside the provider", async () => {
  expect((await renderHookError(() => useConnectivity()))?.message).toContain("useConnectivity must be used within ConnectivityProvider");
});

describe("reading the connection", () => {
  test("starts loading and assumes online, then reports the real state", async () => {
    // Held open, because an awaited render already flushes a settled read.
    let finishFetch: (state: NetState) => void = () => undefined;
    mockFetch.mockReturnValue(new Promise<NetState>((resolve) => (finishFetch = resolve)));
    const { result } = await renderHook(() => useConnectivity(), { wrapper });

    expect(result.current.connectivityLoading).toBe(true);
    expect(result.current.isOnline).toBe(true);

    await act(async () => finishFetch(WIFI));
    await waitFor(() => expect(result.current.connectivityLoading).toBe(false));
    expect(result.current.lastState).toEqual(WIFI);
  });

  test.each([
    ["connected and reachable", { isConnected: true, isInternetReachable: true }, true],
    ["connected, reachability unknown yet", { isConnected: true, isInternetReachable: null }, true],
    ["connected to a captive portal", { isConnected: true, isInternetReachable: false }, false],
    ["disconnected", { isConnected: false, isInternetReachable: null }, false],
    ["connection state unknown", { isConnected: null, isInternetReachable: null }, false],
  ])("is online=%p when %s", async (_name, state, online) => {
    mockFetch.mockResolvedValue({ ...state, type: "wifi" });

    const { result } = await renderConnectivity();

    expect(result.current.isOnline).toBe(online);
  });

  test("assumes offline when NetInfo itself fails", async () => {
    mockFetch.mockRejectedValue(new Error("native module missing"));

    const { result } = await renderConnectivity();

    expect(result.current.isOnline).toBe(false);
  });

  test("follows changes reported by the listener", async () => {
    const { result } = await renderConnectivity();

    await change(NO_SIGNAL);
    expect(result.current.isOnline).toBe(false);

    await change(WIFI);
    expect(result.current.isOnline).toBe(true);
  });

  test("stops listening on unmount", async () => {
    const { unmount } = await renderConnectivity();

    await unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("offline analytics", () => {
  test("reports losing the connection once per drop", async () => {
    await renderConnectivity();

    await change(NO_SIGNAL);
    await change(NO_SIGNAL); // a second identical event while still offline
    await change(WIFI);
    await change(NO_SIGNAL);

    expect(offlineEvents()).toBe(2);
  });

  test("reports nothing while the connection stays up", async () => {
    await renderConnectivity();

    await change(WIFI);

    expect(offlineEvents()).toBe(0);
  });

  // FIXME: isOnline starts true before the first NetInfo read, so opening
  // the app with no signal looks like a dropped connection and is reported —
  // the very case the comment in ConnectivityContext says should not count.
  test.failing("does not report opening the app with no signal as going offline", async () => {
    mockFetch.mockResolvedValue(NO_SIGNAL);

    await renderConnectivity();

    expect(offlineEvents()).toBe(0);
  });
});

describe("forcing a state", () => {
  test("forceOffline wins over the listener until refresh", async () => {
    const { result } = await renderConnectivity();

    await act(() => result.current.forceOffline());
    expect(result.current.isOnline).toBe(false);

    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isOnline).toBe(true));
  });

  test("forceOnline reports online even with no signal", async () => {
    mockFetch.mockResolvedValue(NO_SIGNAL);
    const { result } = await renderConnectivity();

    await act(() => result.current.forceOnline());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.connectivityLoading).toBe(false);
  });

  test("forcing a state stops the real listener", async () => {
    const { result } = await renderConnectivity();
    const unsubscribesBefore = mockUnsubscribe.mock.calls.length;

    await act(() => result.current.forceOnline());

    expect(mockUnsubscribe.mock.calls.length).toBe(unsubscribesBefore + 1);
  });

  test("refresh re-reads the connection", async () => {
    const { result } = await renderConnectivity();
    mockFetch.mockResolvedValue(NO_SIGNAL);

    await act(() => result.current.refresh());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
