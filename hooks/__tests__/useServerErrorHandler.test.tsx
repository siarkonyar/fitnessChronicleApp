import { renderHook } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import { useServerErrorHandler } from "../useServerErrorHandler";

let mockIsOnline = false;
let mockPathname = "/(tabs)";
const mockPush = jest.fn();
const mockReload = jest.fn();

jest.mock("@/context/ConnectivityContext", () => ({
  useConnectivity: () => ({ isOnline: mockIsOnline }),
}));

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname,
}));

jest.mock("expo-updates", () => ({
  reloadAsync: () => mockReload(),
}));

const NETWORK_ERROR = new Error("Network request failed");

let alertSpy: jest.SpyInstance;

const lastAlert = () => {
  const calls = alertSpy.mock.calls;
  const [title, message, buttons, options] = calls[calls.length - 1];
  return { title, message, buttons: buttons as AlertButton[], options };
};

const press = (text: string) =>
  lastAlert().buttons.find((button) => button.text === text)?.onPress?.();

const handler = async () => (await renderHook(() => useServerErrorHandler())).result.current;

beforeEach(() => {
  mockIsOnline = false;
  mockPathname = "/(tabs)";
  mockPush.mockReset();
  mockReload.mockReset().mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  // The "alert already showing" flag is module state; dismissing clears it so
  // one test's alert cannot suppress the next test's.
  if (alertSpy.mock.calls.length > 0) lastAlert().options?.onDismiss?.();
  jest.restoreAllMocks();
});

describe("offline network errors", () => {
  test("offer the offline page and report the error as handled", async () => {
    expect((await handler()).handleQueryError(NETWORK_ERROR)).toBe(true);

    expect(lastAlert().title).toBe("You're Offline");
    expect(lastAlert().buttons.map((b) => b.text)).toEqual(["Go to Offline Page", "Retry"]);
  });

  test("open the offline page from the alert", async () => {
    (await handler()).handleMutationError(NETWORK_ERROR);

    press("Go to Offline Page");

    expect(mockPush).toHaveBeenCalledWith("/offline");
  });

  test("Retry reloads the app, and a failed reload does not throw", async () => {
    mockReload.mockRejectedValue(new Error("no updates in dev"));
    (await handler()).handleQueryError(NETWORK_ERROR);

    press("Retry");
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  test("show only one alert while several requests fail at once", async () => {
    const { handleQueryError, handleMutationError } = await handler();

    expect(handleQueryError(NETWORK_ERROR)).toBe(true);
    expect(handleQueryError(NETWORK_ERROR)).toBe(true);
    expect(handleMutationError(NETWORK_ERROR)).toBe(true);

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  test("can alert again once the first alert was answered", async () => {
    const { handleQueryError } = await handler();
    handleQueryError(NETWORK_ERROR);

    press("Go to Offline Page");
    handleQueryError(NETWORK_ERROR);

    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  test.each(["/offline", "/offline/logExercise"])(
    "stay silent on %s, where the user already is offline",
    async (path) => {
      mockPathname = path;

      expect((await handler()).handleQueryError(NETWORK_ERROR)).toBe(true);
      expect(alertSpy).not.toHaveBeenCalled();
    },
  );

  test("let a custom offline handler replace the alert", async () => {
    const onOfflineError = jest.fn().mockReturnValue(true);

    expect((await handler()).handleQueryError(NETWORK_ERROR, { onOfflineError })).toBe(true);

    expect(onOfflineError).toHaveBeenCalledWith(NETWORK_ERROR);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("fall back to the alert when the custom handler declines", async () => {
    (await handler()).handleQueryError(NETWORK_ERROR, { onOfflineError: () => false });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});

describe("classifying errors", () => {
  test.each([
    ["a fetch failure", new Error("Failed to fetch")],
    ["a timeout", new Error("Request timeout")],
    ["ECONNREFUSED", new Error("connect ECONNREFUSED 127.0.0.1")],
    ["ENOTFOUND", new Error("getaddrinfo ENOTFOUND example.com")],
    ["a NETWORK_ERROR code", { code: "NETWORK_ERROR" }],
    ["a callable 'unavailable' code", { code: "unavailable" }],
    ["a callable 'failed-precondition' code", { code: "failed-precondition" }],
  ])("treat %s as a network error", async (_name, error) => {
    expect((await handler()).handleQueryError(error)).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  // FIXME: React Native Firebase prefixes Firestore error codes with the
  // module name ("firestore/unavailable"), so this comparison never matches
  // a Firestore outage on device.
  test.failing("treats a Firestore 'firestore/unavailable' error as a network error", async () => {
    expect((await handler()).handleQueryError({ code: "firestore/unavailable", message: "x" })).toBe(true);
  });

  test("log a network error silently while the device believes it is online", async () => {
    mockIsOnline = true;

    expect((await handler()).handleQueryError(NETWORK_ERROR)).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test.each([
    ["a permission error", { code: "permission-denied", message: "Missing permissions" }],
    ["a plain Error", new Error("Something broke")],
    ["null", null],
    ["undefined", undefined],
    ["a string", "boom"],
  ])("leave %s for the caller to handle", async (_name, error) => {
    expect((await handler()).handleQueryError(error)).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("route a validation error to a custom validation handler", async () => {
    const onValidationError = jest.fn().mockReturnValue(true);

    expect(
      (await handler()).handleMutationError({ code: "VALIDATION_ERROR" }, { onValidationError }),
    ).toBe(true);
  });

  test("route a 5xx response to a custom server handler", async () => {
    const onServerError = jest.fn().mockReturnValue(true);

    expect((await handler()).handleQueryError({ status: 503 }, { onServerError })).toBe(true);
    expect((await handler()).handleQueryError({ status: 499 }, { onServerError })).toBe(false);
  });

  test("treat any message containing 'invalid' as a validation error", async () => {
    // Pinned: substring matching is broad — "Invalid date." from a Zod parse
    // reaches the validation handler too.
    const onValidationError = jest.fn().mockReturnValue(true);

    (await handler()).handleQueryError(new Error("invalid input"), { onValidationError });

    expect(onValidationError).toHaveBeenCalled();
  });

  test("check validation before the offline path", async () => {
    // An error that is both: the validation handler wins and no alert shows.
    const error = new Error("invalid response: Network request failed");

    (await handler()).handleQueryError(error, { onValidationError: () => true });

    expect(alertSpy).not.toHaveBeenCalled();
  });
});
