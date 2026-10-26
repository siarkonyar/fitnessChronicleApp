/** AddProgramExerciseModal: opening it on an existing exercise fills the form. */
import { render, screen } from "@testing-library/react-native";
import React from "react";
import AddProgramExerciseModal from "../AddProgramExerciseModal";

jest.mock("@/lib/offlineStorage", () => ({
  getDefaultRepType: () => Promise.resolve(false),
  getDefaultMeasurement: () => Promise.resolve("kg"),
}));

// Stand-ins that show the form state this suite checks. The real children
// need the native gesture and animation runtimes.
jest.mock("@/components/exercise/ExerciseNameInput", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return function MockExerciseNameInput({ title }: { title: string }) {
    return <MockText>{`title:${title}`}</MockText>;
  };
});
jest.mock("../../exercise/AddSetCard", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return {
    AddSetCard: ({ reps, setType }: { reps: string; setType: string }) => (
      <MockText>{`set:${setType}:${reps}`}</MockText>
    ),
  };
});
jest.mock("@/context/SheetBlurTargetContext", () => ({
  SheetModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const bench = {
  activity: "bench press",
  sets: [
    { measure: "kg" as const, setType: "warmup" as const, reps: "10" },
    { measure: "kg" as const, setType: "normal" as const, reps: "8" },
  ],
};

const squat = {
  activity: "squat",
  sets: [{ measure: "kg" as const, setType: "normal" as const, reps: "5" }],
};

function modal(props: { visible: boolean; initialExercise?: typeof bench }) {
  return (
    <AddProgramExerciseModal
      dayIndex={0}
      onClose={jest.fn()}
      onAddExercise={jest.fn()}
      {...props}
    />
  );
}

test("opens filled with the exercise being edited", async () => {
  await render(modal({ visible: true, initialExercise: bench }));

  expect(await screen.findByText("title:bench press")).toBeTruthy();
  expect(screen.getByText("set:warmup:10")).toBeTruthy();
  expect(screen.getByText("set:normal:8")).toBeTruthy();
});

test("fills again from the next exercise each time it reopens", async () => {
  const view = await render(modal({ visible: true, initialExercise: bench }));
  await screen.findByText("title:bench press");

  await view.rerender(modal({ visible: false, initialExercise: bench }));
  await view.rerender(modal({ visible: true, initialExercise: squat }));

  expect(await screen.findByText("title:squat")).toBeTruthy();
  expect(screen.getByText("set:normal:5")).toBeTruthy();
});

test("opens empty when adding a new exercise", async () => {
  await render(modal({ visible: true }));

  expect(await screen.findByText("title:")).toBeTruthy();
  expect(screen.queryByText(/^set:/)).toBeNull();
});
