/** The thin providers: each must expose its hook's value and refuse to run bare. */
import { renderHook } from "@testing-library/react-native";
import React from "react";
import { ActiveProgramProvider, useActiveProgramContext } from "../ActiveProgramContext";
import { ChatProvider, useChatContext } from "../ChatContext";
import { InsideBottomSheetProvider, useInsideBottomSheet } from "../InsideBottomSheetContext";

const mockChat = { messages: [], sendMessage: jest.fn(), isSending: false };
const mockActive = {
  activeProgram: { id: "p1" },
  programDay: 2,
  selectProgram: jest.fn(),
  selectProgramDay: jest.fn(),
  removeProgramSelection: jest.fn(),
  isSelecting: false,
  isLoading: false,
  isRemovingSelection: false,
};

jest.mock("@/hooks/useChatBox", () => ({ useChatBox: () => mockChat }));
jest.mock("@/hooks/useActiveProgram", () => ({ useActiveProgram: () => mockActive }));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ChatProvider", () => {
  test("shares the chat state with its children", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    expect(renderHook(() => useChatContext(), { wrapper }).result.current).toBe(mockChat);
  });

  test("refuses to run without a provider", () => {
    expect(() => renderHook(() => useChatContext())).toThrow(
      "ChatContext must be used within an ChatProvider",
    );
  });
});

describe("ActiveProgramProvider", () => {
  test("shares every field of the active program state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ActiveProgramProvider>{children}</ActiveProgramProvider>
    );

    expect(renderHook(() => useActiveProgramContext(), { wrapper }).result.current).toEqual(mockActive);
  });

  test("refuses to run without a provider", () => {
    expect(() => renderHook(() => useActiveProgramContext())).toThrow(
      "useActiveProgramContext must be used within an ActiveProgramProvider",
    );
  });
});

describe("InsideBottomSheetProvider", () => {
  test("is false outside any bottom sheet", () => {
    expect(renderHook(() => useInsideBottomSheet()).result.current).toBe(false);
  });

  test("is true inside, however deeply nested", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InsideBottomSheetProvider>
        <React.Fragment>{children}</React.Fragment>
      </InsideBottomSheetProvider>
    );

    expect(renderHook(() => useInsideBottomSheet(), { wrapper }).result.current).toBe(true);
  });
});
