import {
  logEvent,
  logScreenView,
  setCollectionEnabled,
  setUserId,
  setUserProperty,
} from "../client";

const mockInstance = { name: "analytics" };
const mockGetAnalytics = jest.fn();
const mockLogEvent = jest.fn();
const mockSetCollectionEnabled = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperty = jest.fn();
const mockPostHogCapture = jest.fn();
const mockPostHogScreen = jest.fn();

jest.mock("../posthog", () => ({
  runWithPostHogConsent: (run: (client: unknown) => void) => run({
    capture: mockPostHogCapture,
    screen: mockPostHogScreen,
    logger: { info: jest.fn() },
  }),
  setPostHogCollectionEnabled: jest.fn(),
}));

jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: () => mockGetAnalytics(),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  setAnalyticsCollectionEnabled: (...args: unknown[]) => mockSetCollectionEnabled(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperty: (...args: unknown[]) => mockSetUserProperty(...args),
}));

/** Lets a rejected fire-and-forget promise reach its .catch handler. */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/** Sends arbitrary params through the typed API, for sanitizer edge cases. */
const logRaw = (params: Record<string, unknown>) =>
  logEvent("settings_changed", params as never);

const sentParams = () => mockLogEvent.mock.calls[0][2];

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAnalytics.mockReturnValue(mockInstance);
  mockPostHogScreen.mockResolvedValue(undefined);
  for (const fn of [mockSetCollectionEnabled, mockSetUserId, mockSetUserProperty]) {
    fn.mockResolvedValue(undefined);
  }
  // React Native Firebase 26's logEvent is fire-and-forget: it returns nothing.
  mockLogEvent.mockReturnValue(undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("logEvent", () => {
  test("sends the event with its params to the analytics instance", () => {
    logEvent("ai_message_sent", { source: "pill", message_length: 12, history_length: 3 });

    expect(mockLogEvent).toHaveBeenCalledWith(mockInstance, "ai_message_sent", {
      source: "pill",
      message_length: 12,
      history_length: 3,
    });
  });

  test("keeps false and 0, which are real values", () => {
    logRaw({ has_program: false, latency_ms: 0 });

    expect(sentParams()).toEqual({ has_program: false, latency_ms: 0 });
  });

  test("drops null, undefined, NaN and infinite values", () => {
    logRaw({ a: null, b: undefined, c: Number.NaN, d: Infinity, e: -Infinity, kept: 1 });

    expect(sentParams()).toEqual({ kept: 1 });
  });

  test("cuts string values to GA4's 100 characters", () => {
    logRaw({ value: "x".repeat(150) });

    expect(sentParams().value).toHaveLength(100);
  });

  test("cuts param names to GA4's 40 characters", () => {
    logRaw({ ["k".repeat(45)]: 1 });

    expect(Object.keys(sentParams())).toEqual(["k".repeat(40)]);
  });

  test("sends at most 25 params", () => {
    logRaw(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, i])));

    expect(Object.keys(sentParams())).toHaveLength(25);
    expect(sentParams()).not.toHaveProperty("p25");
  });

  test("counts dropped empty values toward the 25-param cap", () => {
    // The cap is applied before empty values are removed, so 25 nulls up
    // front push a real 26th value out. Pinned: callers stay well under 25.
    const params = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`n${i}`, null]));
    logRaw({ ...params, real: 1 });

    expect(sentParams()).toEqual({});
  });

  test("stringifies objects instead of sending them", () => {
    logRaw({ value: { nested: true } });

    expect(sentParams().value).toBe("[object Object]");
  });

  test("does not modify the params object it was given", () => {
    const params = { value: "x".repeat(150), gone: null };
    const copy = { ...params };

    logRaw(params);

    expect(params).toEqual(copy);
  });

  test("never throws when the native module is missing", () => {
    mockGetAnalytics.mockImplementation(() => {
      throw new Error("native module not linked");
    });

    expect(() => logEvent("logout", {})).not.toThrow();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  test("swallows a send that throws, warning only in development", () => {
    mockLogEvent.mockImplementation(() => {
      throw new Error("invalid event");
    });

    expect(() => logEvent("logout", {})).not.toThrow();
    expect(warn).toHaveBeenCalledWith("[analytics] logEvent(logout) failed:", expect.any(Error));
  });
});

describe("logScreenView", () => {
  test("sends the route to PostHog even when Firebase Analytics is unavailable", () => {
    mockGetAnalytics.mockImplementation(() => { throw new Error("native module missing"); });
    logScreenView("/(tabs)/ai");
    expect(mockPostHogScreen).toHaveBeenCalledWith("/(tabs)/ai");
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  test("a PostHog screen failure does not stop Firebase tracking or leak a rejection", async () => {
    mockPostHogScreen.mockRejectedValue(new Error("PostHog unavailable"));
    logScreenView("/(tabs)/ai");
    await flushPromises();
    expect(mockLogEvent).toHaveBeenCalledWith(mockInstance, "screen_view", {
      screen_name: "/(tabs)/ai", screen_class: "/(tabs)/ai",
    });
    expect(warn).toHaveBeenCalledWith("[analytics] posthog.screen failed:", expect.any(Error));
  });

  test("sends screen_view with the route as both name and class", () => {
    logScreenView("/(tabs)/ai");

    expect(mockLogEvent).toHaveBeenCalledWith(mockInstance, "screen_view", {
      screen_name: "/(tabs)/ai",
      screen_class: "/(tabs)/ai",
    });
  });

  test("cuts a very long route to 100 characters", () => {
    logScreenView(`/${"a".repeat(200)}`);

    expect(sentParams().screen_name).toHaveLength(100);
  });
});

describe("user identity and collection switch", () => {
  test("sets and clears the user id", () => {
    setUserId("uid-1");
    setUserId(null);

    expect(mockSetUserId.mock.calls).toEqual([
      [mockInstance, "uid-1"],
      [mockInstance, null],
    ]);
  });

  test("cuts user property names and values to GA4's limits", () => {
    setUserProperty("p".repeat(50), "v".repeat(150));

    const [, key, value] = mockSetUserProperty.mock.calls[0];
    expect(key).toHaveLength(40);
    expect(value).toHaveLength(100);
  });

  test("passes a null user property through to clear it", () => {
    setUserProperty("tier", null);

    expect(mockSetUserProperty).toHaveBeenCalledWith(mockInstance, "tier", null);
  });

  test("forwards the collection switch", () => {
    setCollectionEnabled(true);
    setCollectionEnabled(false);

    expect(mockSetCollectionEnabled.mock.calls.map(([, on]) => on)).toEqual([true, false]);
  });

  test("none of them throw when the native module is missing", () => {
    mockGetAnalytics.mockImplementation(() => {
      throw new Error("native module not linked");
    });

    expect(() => {
      setUserId("u");
      setUserProperty("k", "v");
      setCollectionEnabled(true);
      logScreenView("/x");
    }).not.toThrow();
  });

  test("none of them leak a rejected promise", async () => {
    mockSetUserId.mockRejectedValue(new Error("x"));
    mockSetUserProperty.mockRejectedValue(new Error("x"));
    mockSetCollectionEnabled.mockRejectedValue(new Error("x"));
    mockLogEvent.mockImplementation(() => {
      throw new Error("x");
    });

    setUserId("u");
    setUserProperty("k", "v");
    setCollectionEnabled(false);
    logScreenView("/x");
    await flushPromises();

    expect(warn).toHaveBeenCalledTimes(4);
  });
});
