/** The thin providers: each must expose its hook's value and refuse to run bare. */
import { renderHook } from "@testing-library/react-native";
import React from "react";
import { renderHookError } from "@/hooks/__tests__/renderHookError";
import { ActiveProgramProvider, useActiveProgramContext } from "../ActiveProgramContext";
import { ChatProvider, useChatContext } from "../ChatContext";
import { InsideBottomSheetProvider, useInsideBottomSheet } from "../InsideBottomSheetContext";
import { SheetModalProvider, useSheetBlurTarget } from "../SheetBlurTargetContext";

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
// The real provider needs the native gesture and animation runtimes; only the
// children it renders matter here.
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ChatProvider", () => {
  test("shares the chat state with its children", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    expect((await renderHook(() => useChatContext(), { wrapper })).result.current).toBe(mockChat);
  });

  test("refuses to run without a provider", async () => {
    expect((await renderHookError(() => useChatContext()))?.message).toContain("ChatContext must be used within an ChatProvider");
  });
});

describe("ActiveProgramProvider", () => {
  test("shares every field of the active program state", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ActiveProgramProvider>{children}</ActiveProgramProvider>
    );

    expect((await renderHook(() => useActiveProgramContext(), { wrapper })).result.current).toEqual(mockActive);
  });

  test("refuses to run without a provider", async () => {
    expect((await renderHookError(() => useActiveProgramContext()))?.message).toContain("useActiveProgramContext must be used within an ActiveProgramProvider");
  });
});

describe("InsideBottomSheetProvider", () => {
  test("is false outside any bottom sheet", async () => {
    expect((await renderHook(() => useInsideBottomSheet())).result.current).toBe(false);
  });

  test("is true inside, however deeply nested", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InsideBottomSheetProvider>
        <React.Fragment>{children}</React.Fragment>
      </InsideBottomSheetProvider>
    );

    expect((await renderHook(() => useInsideBottomSheet(), { wrapper })).result.current).toBe(true);
  });
});

describe("SheetModalProvider", () => {
  test("has no blur target outside a provider", async () => {
    expect((await renderHook(() => useSheetBlurTarget())).result.current).toBeNull();
  });

  test("points the sheets at the view wrapping its screens", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SheetModalProvider>{children}</SheetModalProvider>
    );

    const blurTarget = (await renderHook(() => useSheetBlurTarget(), { wrapper })).result.current;

    expect(blurTarget?.current).not.toBeNull();
  });
});
