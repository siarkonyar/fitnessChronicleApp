/** ExerciseNameInput suggestions: derived from the typed text, opened and closed by the user. */
import { createTestQueryClient, queryWrapper } from "@/hooks/__tests__/queryWrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React, { useState } from "react";
import ExerciseNameInput from "../ExerciseNameInput";

const mockGetAllExerciseNames = jest.fn();
const mockDeleteExerciseName = jest.fn();

jest.mock("@/lib/firebase/exercise", () => ({
  getAllExerciseNames: () => mockGetAllExerciseNames(),
  deleteExerciseName: (name: string) => mockDeleteExerciseName(name),
}));

jest.mock("@/hooks/useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({ handleMutationError: jest.fn() }),
}));

// The real icon loads its font asynchronously, which only adds act() noise.
// The stand-in renders its name so a test can press it.
jest.mock("@expo/vector-icons/MaterialIcons", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return function MockMaterialIcon({ name }: { name: string }) {
    return <MockText>{`icon:${name}`}</MockText>;
  };
});

/** The parent owns the title, as every screen using the field does. */
function NameField() {
  const [title, setTitle] = useState("");
  return <ExerciseNameInput title={title} setTitle={setTitle} />;
}

function renderField() {
  render(<NameField />, { wrapper: queryWrapper(createTestQueryClient()) });
  const input = screen.getByPlaceholderText("Exercise name...");
  fireEvent(input, "focus");
  return input;
}

beforeEach(() => {
  mockGetAllExerciseNames.mockResolvedValue([{ id: "n1", name: "arnold raise" }]);
  mockDeleteExerciseName.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

test("suggests saved and built-in names that match what was typed", async () => {
  const input = renderField();

  fireEvent.changeText(input, "arnold");

  expect(await screen.findByText("ARNOLD RAISE")).toBeTruthy();
  expect(screen.getByText("ARNOLD PRESS")).toBeTruthy();
});

test("shows no suggestions while the field is empty", async () => {
  renderField();

  await screen.findByPlaceholderText("Exercise name...");

  expect(screen.queryByText("ARNOLD PRESS")).toBeNull();
});

test("keeps the list closed after a suggestion is picked", async () => {
  const input = renderField();
  fireEvent.changeText(input, "arnold");
  await screen.findByText("ARNOLD RAISE");

  fireEvent.press(screen.getByText("ARNOLD PRESS"));

  expect(screen.getByDisplayValue("ARNOLD PRESS")).toBeTruthy();
  expect(screen.queryByText("ARNOLD PRESS")).toBeNull();
  expect(screen.queryByText("ARNOLD RAISE")).toBeNull();
});

test("hides a deleted saved name straight away", async () => {
  const input = renderField();
  fireEvent.changeText(input, "arnold");
  await screen.findByText("ARNOLD RAISE");

  fireEvent.press(screen.getByText("icon:close"));

  expect(screen.queryByText("ARNOLD RAISE")).toBeNull();
  expect(screen.getByText("ARNOLD PRESS")).toBeTruthy();
  await waitFor(() =>
    expect(mockDeleteExerciseName).toHaveBeenCalledWith("arnold raise"),
  );
});
