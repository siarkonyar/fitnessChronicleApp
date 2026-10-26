/** Settings profile rows: each edit starts from the stored profile. */
import Settings from "@/app/(screens)/settings";
import { createTestQueryClient, queryWrapper } from "@/hooks/__tests__/queryWrapper";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockGetUserProfile = jest.fn();
const mockUpdateUserProfile = jest.fn();
const mockRefreshUser = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ refreshUser: mockRefreshUser, signOut: jest.fn() }),
}));
jest.mock("@/lib/firebase/user", () => ({
  getUserProfile: () => mockGetUserProfile(),
  getUserSettings: () => Promise.resolve({}),
  updateUserProfile: (update: unknown) => mockUpdateUserProfile(update),
}));
jest.mock("@/lib/offlineStorage", () => ({
  getHapticsEnabled: () => Promise.resolve(true),
  getDefaultRepType: () => Promise.resolve(false),
  getDefaultMeasurement: () => Promise.resolve("kg"),
  saveHapticsEnabled: jest.fn(),
  saveDefaultRepType: jest.fn(),
  saveDefaultMeasurement: jest.fn(),
}));
jest.mock("@/lib/analytics/client", () => ({ logEvent: jest.fn() }));
jest.mock("@/lib/analytics/consent", () => ({ setAnalyticsConsent: jest.fn() }));

// Stand-ins for children this suite does not exercise; the real ones need the
// native animation runtime, icon fonts, or a subscription backend.
jest.mock("@/components/cards/PlanUsageCard", () => () => null);
jest.mock("@/components/ThemedBottomSheetModal", () =>
  jest.requireActual("react").forwardRef(() => null),
);
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@expo/vector-icons", () => new Proxy({}, { get: () => () => null }));
jest.mock("@expo/vector-icons/MaterialIcons", () => () => null);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { clear: jest.fn() },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-updates", () => ({ reloadAsync: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const storedProfile = { name: "Siar", birthday: "1995-04-12" };

const editButtons = () => screen.UNSAFE_getAllByProps({ icon: "edit" });

async function renderSettings() {
  render(<Settings />, { wrapper: queryWrapper(createTestQueryClient()) });
  await screen.findByText("Siar");
}

beforeEach(() => {
  mockGetUserProfile.mockResolvedValue(storedProfile);
  mockUpdateUserProfile.mockResolvedValue(undefined);
  mockRefreshUser.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

test("opens the name editor on the stored name", async () => {
  await renderSettings();

  fireEvent.press(editButtons()[0]);

  expect(screen.getByDisplayValue("Siar")).toBeTruthy();
});

test("starts again from the stored name after a cancelled edit", async () => {
  await renderSettings();

  fireEvent.press(editButtons()[0]);
  fireEvent.changeText(screen.getByDisplayValue("Siar"), "Ada");
  fireEvent.press(screen.UNSAFE_getByProps({ icon: "x" }));
  fireEvent.press(editButtons()[0]);

  expect(screen.getByDisplayValue("Siar")).toBeTruthy();
});

test("keeps the editor open until the profile has the new name", async () => {
  await renderSettings();
  let finishReload: (profile: typeof storedProfile) => void = () => undefined;
  mockGetUserProfile.mockImplementation(
    () => new Promise((resolve) => (finishReload = resolve)),
  );

  fireEvent.press(editButtons()[0]);
  fireEvent.changeText(screen.getByDisplayValue("Siar"), "Ada");
  await act(async () => {
    fireEvent.press(screen.UNSAFE_getByProps({ icon: "check" }));
  });

  // Still editing while the profile reloads, so the old name never shows.
  expect(screen.getByDisplayValue("Ada")).toBeTruthy();
  expect(screen.queryByText("Siar")).toBeNull();

  await act(async () => finishReload({ ...storedProfile, name: "Ada" }));

  expect(await screen.findByText("Ada")).toBeTruthy();
  expect(mockUpdateUserProfile).toHaveBeenCalledWith({ name: "Ada" });
});

test("opens the birthday editor on the stored birthday", async () => {
  await renderSettings();

  fireEvent.press(editButtons()[1]);

  expect(screen.getByDisplayValue("12")).toBeTruthy();
  expect(screen.getByDisplayValue("04")).toBeTruthy();
  expect(screen.getByDisplayValue("1995")).toBeTruthy();
});
