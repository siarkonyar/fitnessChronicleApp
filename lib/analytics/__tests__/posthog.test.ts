const mockClient = {
  ready: jest.fn(),
  optIn: jest.fn(),
  optOut: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  capture: jest.fn(),
};
const mockConstructor = jest.fn();
let mockExtra: Record<string, string>;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { get expoConfig() { return { extra: mockExtra }; } },
}));
jest.mock("posthog-react-native", () => ({
  __esModule: true,
  default: function (...args: unknown[]) {
    mockConstructor(...args);
    return mockClient;
  },
}));

let analytics: typeof import("../posthog");
const settle = () => new Promise((resolve) => setImmediate(resolve));
const options = () => mockConstructor.mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  mockExtra = { posthogProjectToken: "test-token", posthogHost: "https://eu.i.posthog.com" };
  mockClient.ready.mockResolvedValue(undefined);
  mockClient.optIn.mockResolvedValue(undefined);
  mockClient.optOut.mockResolvedValue(undefined);
  mockClient.identify.mockImplementation(() => undefined);
  mockConstructor.mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.isolateModules(() => { analytics = jest.requireActual("../posthog"); });
});
afterEach(() => jest.restoreAllMocks());

test("starts with events and logs blocked, even with a persisted SDK opt-in", () => {
  expect(options()).toMatchObject({ defaultOptIn: false, captureAppLifecycleEvents: false });
  expect(options().before_send({ event: "$exception" })).toBeNull();
  expect(options().logs.beforeSend({ body: "test" })).toBeNull();
  expect(mockClient.identify).not.toHaveBeenCalled();
});

test("identifies only a UID after consent and blocks capture immediately on account change", async () => {
  analytics.setPostHogUser("first-user");
  expect(mockClient.identify).not.toHaveBeenCalled();
  analytics.setPostHogCollectionEnabled(true);
  await settle();
  expect(mockClient.identify.mock.calls).toEqual([["first-user"]]);
  expect(options().before_send({ event: "login" })).toEqual({ event: "login" });
  expect(options().logs.beforeSend({ body: "test" })).toEqual({ body: "test" });

  analytics.setPostHogUser("second-user");
  expect(analytics.isPostHogCollectionEnabled()).toBe(false);
  expect(options().before_send({ event: "$exception" })).toBeNull();
  expect(options().logs.beforeSend({ body: "test" })).toBeNull();
  expect(mockClient.reset).toHaveBeenCalledTimes(2);
  analytics.setPostHogCollectionEnabled(true);
  await settle();
  expect(mockClient.identify.mock.calls).toEqual([["first-user"], ["second-user"]]);
  analytics.setPostHogUser(null);
  expect(analytics.isPostHogCollectionEnabled()).toBe(false);
});

test("a delayed SDK initialization cannot undo a later opt-out", async () => {
  let ready!: () => void;
  mockClient.ready.mockReturnValue(new Promise<void>((resolve) => { ready = resolve; }));
  analytics.setPostHogUser("user");
  analytics.setPostHogCollectionEnabled(true);
  analytics.setPostHogCollectionEnabled(false);
  ready();
  await settle();
  expect(mockClient.optIn).not.toHaveBeenCalled();
  expect(mockClient.identify).not.toHaveBeenCalled();
  expect(analytics.isPostHogCollectionEnabled()).toBe(false);
});

test("does not enable capture while signed out", async () => {
  analytics.setPostHogUser(null);
  analytics.setPostHogCollectionEnabled(true);
  await settle();
  expect(mockClient.optIn).not.toHaveBeenCalled();
  expect(analytics.isPostHogCollectionEnabled()).toBe(false);
});

test("preserves the first event after opt-in and drops pending events on account change", async () => {
  analytics.setPostHogUser("user");
  analytics.setPostHogCollectionEnabled(true);
  analytics.runWithPostHogConsent((client) => client.capture("sign_up"));
  await settle();
  expect(mockClient.capture).toHaveBeenCalledWith("sign_up");
  analytics.setPostHogCollectionEnabled(true);
  analytics.runWithPostHogConsent((client) => client.capture("old-account-event"));
  analytics.setPostHogUser("other-user");
  analytics.setPostHogCollectionEnabled(true);
  await settle();
  expect(mockClient.capture).not.toHaveBeenCalledWith("old-account-event");
});

test("a rejected opt-in does not escape and keeps capture off", async () => {
  mockClient.optIn.mockRejectedValue(new Error("storage failed"));
  analytics.setPostHogUser("user");
  analytics.setPostHogCollectionEnabled(true);
  await settle();
  expect(mockClient.identify).not.toHaveBeenCalled();
  expect(analytics.isPostHogCollectionEnabled()).toBe(false);
});

test("missing configuration and constructor failures do not stop the app", () => {
  mockExtra = {};
  jest.isolateModules(() => { analytics = jest.requireActual("../posthog"); });
  expect(analytics.posthog).toBeUndefined();
  mockExtra = { posthogProjectToken: "test", posthogHost: "https://eu.i.posthog.com" };
  mockConstructor.mockImplementation(() => { throw new Error("missing native module"); });
  jest.isolateModules(() => { analytics = jest.requireActual("../posthog"); });
  expect(analytics.posthog).toBeUndefined();
});
