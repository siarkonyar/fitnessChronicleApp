import { applyStoredConsent, setAnalyticsConsent } from "../consent";
import { askForAnalyticsConsent, PRIVACY_POLICY_URL } from "../consentPrompt";
import { flushPendingSignUp, rememberSignUp } from "../pendingSignUp";
import { Alert, type AlertButton } from "react-native";

const mockGetUserSettings = jest.fn();
const mockUpdateUserSettings = jest.fn();
const mockSetCollectionEnabled = jest.fn();
const mockLogEvent = jest.fn();

jest.mock("@/lib/firebase/user", () => ({
  getUserSettings: () => mockGetUserSettings(),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

jest.mock("../client", () => ({
  setCollectionEnabled: (...args: unknown[]) => mockSetCollectionEnabled(...args),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Whatever an earlier test left armed is spent before the next one runs.
  flushPendingSignUp();
  mockLogEvent.mockReset();
});

describe("applyStoredConsent", () => {
  test.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])("a stored choice of %p turns collection %p", async (stored, expected) => {
    mockGetUserSettings.mockResolvedValue({ measure: "kg", analyticsConsent: stored });

    await applyStoredConsent();

    expect(mockSetCollectionEnabled).toHaveBeenCalledWith(expected);
  });

  test("leaves collection untouched (still off) when settings cannot be read", async () => {
    mockGetUserSettings.mockRejectedValue(new Error("offline"));

    await expect(applyStoredConsent()).rejects.toThrow("offline");
    expect(mockSetCollectionEnabled).not.toHaveBeenCalled();
  });
});

describe("setAnalyticsConsent", () => {
  test("switches the SDK before the write has been confirmed", () => {
    mockUpdateUserSettings.mockReturnValue(new Promise(() => undefined)); // offline forever

    setAnalyticsConsent(false);

    expect(mockSetCollectionEnabled).toHaveBeenCalledWith(false);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith({ analyticsConsent: false });
  });

  test("returns immediately even while the write is pending offline", () => {
    mockUpdateUserSettings.mockReturnValue(new Promise(() => undefined));

    expect(setAnalyticsConsent(true)).toBeUndefined();
  });

  test("logs a failed write instead of throwing it", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockUpdateUserSettings.mockRejectedValue(new Error("permission-denied"));

    setAnalyticsConsent(true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(error).toHaveBeenCalledWith("Failed to persist analytics consent:", expect.any(Error));
    expect(mockSetCollectionEnabled).toHaveBeenCalledWith(true);
    error.mockRestore();
  });
});

describe("askForAnalyticsConsent", () => {
  const promptButtons = () => {
    const [, , buttons, options] = (Alert.alert as jest.Mock).mock.calls[0];
    return { buttons: buttons as AlertButton[], options };
  };

  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  test("resolves true only for Allow", async () => {
    const answer = askForAnalyticsConsent();
    promptButtons().buttons.find((b) => b.text === "Allow")?.onPress?.();

    await expect(answer).resolves.toBe(true);
  });

  test("resolves false for Not now", async () => {
    const answer = askForAnalyticsConsent();
    promptButtons().buttons.find((b) => b.text === "Not now")?.onPress?.();

    await expect(answer).resolves.toBe(false);
  });

  test("treats a dismissal as a refusal, never as silence", async () => {
    const answer = askForAnalyticsConsent();
    promptButtons().options.onDismiss();

    await expect(answer).resolves.toBe(false);
  });

  test("cannot be dismissed by tapping outside or Android back", () => {
    void askForAnalyticsConsent();

    expect(promptButtons().options.cancelable).toBe(false);
  });

  test("keeps the first answer if a dismissal arrives after Allow", async () => {
    const answer = askForAnalyticsConsent();
    const { buttons, options } = promptButtons();
    buttons.find((b) => b.text === "Allow")?.onPress?.();
    options.onDismiss();

    await expect(answer).resolves.toBe(true);
  });

  test("never claims the data is anonymous or covers crashes", () => {
    void askForAnalyticsConsent();
    const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];

    expect(`${title} ${message}`).not.toMatch(/anonymous|crash/i);
  });

  test("links a secure privacy policy", () => {
    expect(PRIVACY_POLICY_URL).toMatch(/^https:\/\//);
  });
});

describe("pending sign-up", () => {
  test("reports nothing for a returning user", () => {
    flushPendingSignUp();

    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  test("reports a remembered sign-up exactly once", () => {
    rememberSignUp("apple");

    flushPendingSignUp();
    flushPendingSignUp();

    expect(mockLogEvent.mock.calls).toEqual([["sign_up", { method: "apple" }]]);
  });

  test("the latest sign-up method wins if sign-in is repeated", () => {
    rememberSignUp("google");
    rememberSignUp("apple");

    flushPendingSignUp();

    expect(mockLogEvent).toHaveBeenCalledWith("sign_up", { method: "apple" });
  });

  test("is disarmed before reporting, so a crash cannot fire it twice", () => {
    mockLogEvent.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    rememberSignUp("google");

    expect(() => flushPendingSignUp()).toThrow("boom");
    flushPendingSignUp();

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
  });
});
