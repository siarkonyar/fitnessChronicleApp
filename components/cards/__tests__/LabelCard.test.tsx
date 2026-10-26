/** LabelCard edit mode: each edit starts from the saved label. */
import { createTestQueryClient, queryWrapper } from "@/hooks/__tests__/queryWrapper";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import LabelCard from "../LabelCard";

const mockEditLabel = jest.fn();
const mockHandleMutationError = jest.fn();

jest.mock("@/lib/firebase/label", () => ({
  editLabel: (...args: unknown[]) => mockEditLabel(...args),
  deleteLabel: jest.fn(),
}));

jest.mock("@/hooks/useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({ handleMutationError: mockHandleMutationError }),
}));

// The real package needs the native animation runtime. Outside a bottom sheet
// the card renders the plain text input, so the sheet input is never shown.
jest.mock("@gorhom/bottom-sheet", () => ({ BottomSheetTextInput: () => null }));

const savedLabel = { id: "label-1", label: "P", description: "Push" };

function renderCard(label = savedLabel) {
  return render(<LabelCard index={0} label={label} editable />, {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  mockEditLabel.mockReset();
  mockHandleMutationError.mockReset();
});

test("opens the editor on the saved description", () => {
  renderCard();

  fireEvent.press(screen.UNSAFE_getByProps({ icon: "edit" }));

  expect(screen.getByDisplayValue("Push")).toBeTruthy();
});

test("starts the next edit from the saved label after a failed save", async () => {
  mockEditLabel.mockRejectedValue(new Error("offline"));
  renderCard();

  fireEvent.press(screen.UNSAFE_getByProps({ icon: "edit" }));
  fireEvent.changeText(screen.getByDisplayValue("Push"), "Pull");
  await act(async () => {
    fireEvent.press(screen.UNSAFE_getByProps({ icon: "check" }));
  });
  fireEvent.press(screen.UNSAFE_getByProps({ icon: "edit" }));

  expect(mockHandleMutationError).toHaveBeenCalled();
  expect(screen.getByDisplayValue("Push")).toBeTruthy();
  expect(screen.queryByDisplayValue("Pull")).toBeNull();
});

test("shows a renamed label without entering edit mode", () => {
  const view = renderCard();

  view.rerender(
    <LabelCard index={0} label={{ ...savedLabel, description: "Legs" }} editable />,
  );

  expect(screen.getByText("Legs")).toBeTruthy();
});
