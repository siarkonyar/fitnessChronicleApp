/** Edit exercise: the form follows each loaded version of the exercise. */
import EditExercise from "@/app/(screens)/editExercise";
import { createTestQueryClient, queryWrapper } from "@/hooks/__tests__/queryWrapper";
import { act, render, screen } from "@testing-library/react-native";
import React from "react";

const mockGetExerciseLogById = jest.fn();

jest.mock("@/lib/firebase/exercise", () => ({
  getExerciseLogById: (id: string) => mockGetExerciseLogById(id),
  editExerciseLog: jest.fn(),
  getLatestExercisesByName: () => Promise.resolve([]),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ exerciseId: "log-1" }),
  router: { push: jest.fn() },
}));
jest.mock("@/hooks/useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({
    handleQueryError: jest.fn(),
    handleMutationError: jest.fn(),
  }),
}));
jest.mock("@/lib/analytics/client", () => ({ logEvent: jest.fn() }));
jest.mock("@/lib/offlineStorage", () => ({
  getDefaultRepType: () => Promise.resolve(false),
}));

// Stand-ins that show the form state this suite checks. The real children
// need the native gesture and animation runtimes.
jest.mock("@/components/exercise/ExerciseNameInput", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return ({ title }: { title: string }) => <MockText>{`title:${title}`}</MockText>;
});
jest.mock("../../components/exercise/AddSetCard", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return {
    AddSetCard: ({ value, reps }: { value: string; reps: string }) => (
      <MockText>{`set:${value}x${reps}`}</MockText>
    ),
  };
});
jest.mock("@/components/exercise/GetExerciseCard", () => () => null);
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const transition = { easing: () => transition };
  return {
    __esModule: true,
    default: { View },
    Easing: { out: () => undefined, cubic: undefined },
    FadeInUp: transition,
    LinearTransition: transition,
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const loggedBench = {
  id: "log-1",
  date: "2026-10-20",
  activity: "bench press",
  sets: [
    { measure: "kg", setType: "normal", value: "80", reps: "5" },
    { measure: "kg", setType: "normal", value: "85", reps: "3" },
  ],
};

afterEach(() => {
  jest.clearAllMocks();
});

test("fills the form from the loaded exercise", async () => {
  mockGetExerciseLogById.mockResolvedValue(loggedBench);

  await render(<EditExercise />, { wrapper: queryWrapper(createTestQueryClient()) });

  expect(await screen.findByText("title:BENCH PRESS")).toBeTruthy();
  expect(screen.getByText("set:80x5")).toBeTruthy();
  expect(screen.getByText("set:85x3")).toBeTruthy();
});

test("refills the form when the exercise reloads with new data", async () => {
  mockGetExerciseLogById.mockResolvedValue(loggedBench);
  const client = createTestQueryClient();
  await render(<EditExercise />, { wrapper: queryWrapper(client) });
  await screen.findByText("set:80x5");

  mockGetExerciseLogById.mockResolvedValue({
    ...loggedBench,
    sets: [{ measure: "kg", setType: "normal", value: "90", reps: "2" }],
  });
  await act(() => client.invalidateQueries());

  expect(await screen.findByText("set:90x2")).toBeTruthy();
  expect(screen.queryByText("set:80x5")).toBeNull();
});
