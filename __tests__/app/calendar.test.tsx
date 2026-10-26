/** Calendar: the selected day moves to the new today when the date rolls over. */
import CalendarScreen from "@/app/(tabs)/calendar";
import { createTestQueryClient, queryWrapper } from "@/hooks/__tests__/queryWrapper";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("@/lib/firebase/exercise", () => ({
  getExerciseLogsByMonth: () => Promise.resolve({ logs: [], uniqueDates: [] }),
}));
jest.mock("@/lib/firebase/label", () => ({
  getAllLabels: () => Promise.resolve([]),
  getAllLabelsFromMonth: () => Promise.resolve([]),
}));
jest.mock("@/hooks/useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({ handleQueryError: jest.fn() }),
}));
// Stand-ins: the log list shows which day is selected, and the calendar renders
// one pressable day so a test can pick a date.
jest.mock("@/components/calendar/ExerciseLogByDate", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return ({ selectedDate }: { selectedDate: string }) => (
    <MockText>{`selected:${selectedDate}`}</MockText>
  );
});
jest.mock("react-native-calendars", () => ({
  Calendar: ({
    dayComponent: Day,
  }: {
    dayComponent: React.ComponentType<{
      date: { dateString: string; day: number };
      state: string;
    }>;
  }) => <Day date={{ dateString: "2026-10-20", day: 20 }} state="" />,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

function renderCalendar() {
  return render(<CalendarScreen />, {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

beforeEach(() => {
  // Only the clock is faked; timers stay real so the queries resolve.
  jest.useFakeTimers({
    now: new Date(2026, 9, 26, 23, 59),
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test("selects today when the screen opens", async () => {
  renderCalendar();

  expect(await screen.findByText("selected:2026-10-26")).toBeTruthy();
});

test("moves the selection to the new today after midnight", async () => {
  const view = renderCalendar();
  await screen.findByText("selected:2026-10-26");

  jest.setSystemTime(new Date(2026, 9, 27, 0, 1));
  view.rerender(<CalendarScreen />);

  expect(await screen.findByText("selected:2026-10-27")).toBeTruthy();
});

test("keeps a picked day while the date stays the same", async () => {
  const view = renderCalendar();
  await screen.findByText("selected:2026-10-26");

  fireEvent.press(screen.getByText("20"));
  view.rerender(<CalendarScreen />);

  expect(screen.getByText("selected:2026-10-20")).toBeTruthy();
});
