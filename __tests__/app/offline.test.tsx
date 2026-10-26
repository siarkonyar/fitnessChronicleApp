/** Offline home: loads the saved exercises once each time the screen gains focus. */
import OfflineHome from "@/app/offline";
import { render, screen } from "@testing-library/react-native";
import React from "react";

const mockGetOfflineExercises = jest.fn();

jest.mock("@/lib/offlineStorage", () => ({
  getOfflineExercises: () => mockGetOfflineExercises(),
}));
jest.mock("@/context/ConnectivityContext", () => ({
  useConnectivity: () => ({ isOnline: false, refresh: jest.fn() }),
}));
// React Navigation runs a focus effect when the screen gains focus, which a
// freshly mounted screen has.
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("@/components/exercise/GetExerciseCard", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return ({ exercise }: { exercise: { activity: string } }) => (
    <MockText>{`exercise:${exercise.activity}`}</MockText>
  );
});
jest.mock("@/components/LogoIcon", () => () => null);
jest.mock("@expo/vector-icons/MaterialIcons", () => () => null);
jest.mock("expo-updates", () => ({ reloadAsync: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

afterEach(() => {
  jest.clearAllMocks();
});

test("loads the saved exercises once when the screen opens", async () => {
  mockGetOfflineExercises.mockResolvedValue([
    {
      id: "offline-1",
      date: "2026-10-20",
      activity: "squat",
      sets: [],
      timestamp: "2026-10-20T10:00:00.000Z",
    },
  ]);

  render(<OfflineHome />);

  expect(await screen.findByText("exercise:squat")).toBeTruthy();
  expect(mockGetOfflineExercises).toHaveBeenCalledTimes(1);
});

test("shows the empty state when nothing is saved", async () => {
  mockGetOfflineExercises.mockResolvedValue([]);

  render(<OfflineHome />);

  expect(await screen.findByText("No offline exercise logs found.")).toBeTruthy();
});
