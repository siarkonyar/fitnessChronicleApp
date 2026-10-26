import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { QueryClient } from "@tanstack/react-query";
import { useActiveProgram } from "../useActiveProgram";
import { createTestQueryClient, queryWrapper } from "./queryWrapper";

const mockGetPrograms = jest.fn();
const mockGetUserSettings = jest.fn();
const mockUpdateUserSettings = jest.fn();
const mockLogEvent = jest.fn();
const mockHandleMutationError = jest.fn();
const mockHandleQueryError = jest.fn();

jest.mock("@/lib/firebase/program", () => ({
  getPrograms: () => mockGetPrograms(),
}));

jest.mock("@/lib/firebase/user", () => ({
  getUserSettings: () => mockGetUserSettings(),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

jest.mock("@/lib/analytics/client", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

jest.mock("../useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({
    handleMutationError: mockHandleMutationError,
    handleQueryError: mockHandleQueryError,
  }),
}));

// types/types.ts reads firestore.Timestamp at import time.
jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

const TODAY = "2026-06-10";

const program = (id: string, dayCount: number) => ({
  id,
  name: id,
  days: Array.from({ length: dayCount }, () => ({ isRestDay: true })),
});

let client: QueryClient;
let storedSettings: Record<string, unknown>;

/** The updates written, ignoring the context TanStack passes as a 2nd arg. */
const firstArgs = () => mockUpdateUserSettings.mock.calls.map(([updates]) => updates);

const renderActive = () =>
  renderHook(() => useActiveProgram(), { wrapper: queryWrapper(client) });

beforeEach(() => {
  jest.clearAllMocks();
  client = createTestQueryClient();
  jest.useFakeTimers({ now: new Date(2026, 5, 10, 12), doNotFake: ["nextTick", "setImmediate"] });
  storedSettings = { measure: "kg" };
  mockGetUserSettings.mockImplementation(async () => ({ ...storedSettings }));
  mockUpdateUserSettings.mockImplementation(async (updates: Record<string, unknown>) => {
    storedSettings = { ...storedSettings, ...updates };
  });
  mockGetPrograms.mockResolvedValue([program("ppl", 3), program("full", 1)]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("reading the active program", () => {
  test("is loading until both settings and programs arrive", async () => {
    const { result } = await renderActive();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  test("finds the active program and today's day", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 2, activeProgramDayDate: TODAY };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.activeProgram?.id).toBe("ppl"));
    expect(result.current.programDay).toBe(2);
  });

  test("has no active program when none was chosen", async () => {
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeProgram).toBeUndefined();
  });

  test("has no active program when the chosen one was deleted", async () => {
    storedSettings = { measure: "kg", activeProgramId: "deleted", activeProgramDay: 0, activeProgramDayDate: TODAY };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeProgram).toBeUndefined();
  });

  test("treats the cleared id \"\" as no program", async () => {
    storedSettings = { measure: "kg", activeProgramId: "", activeProgramDay: 0, activeProgramDayDate: TODAY };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeProgram).toBeUndefined();
  });

  test("hands a failed load to the error handler", async () => {
    const error = new Error("Network request failed");
    mockGetPrograms.mockRejectedValue(error);
    await renderActive();

    await waitFor(() => expect(mockHandleQueryError).toHaveBeenCalledWith(error));
  });
});

describe("advancing with the calendar", () => {
  test("moves the stored day forward once, re-anchored to today", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 0, activeProgramDayDate: "2026-06-08" };
    const { result } = await renderActive();

    await waitFor(() =>
      expect(firstArgs()).toEqual([{ activeProgramDay: 2, activeProgramDayDate: TODAY }]),
    );
    await waitFor(() => expect(result.current.programDay).toBe(2));
    expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
  });

  test("wraps past the last day back to the first", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 2, activeProgramDayDate: "2026-06-09" };
    await renderActive();

    await waitFor(() =>
      expect(firstArgs()).toEqual([{ activeProgramDay: 0, activeProgramDayDate: TODAY }]),
    );
  });

  test("does not write anything on the day the program was chosen", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 1, activeProgramDayDate: TODAY };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.activeProgram).toBeDefined());
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  test("does not rewind when the stored date is in the future", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 1, activeProgramDayDate: "2026-06-20" };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.activeProgram).toBeDefined());
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
    expect(result.current.programDay).toBe(1);
  });

  test("does not advance a program without days", async () => {
    mockGetPrograms.mockResolvedValue([program("empty", 0)]);
    storedSettings = { measure: "kg", activeProgramId: "empty", activeProgramDay: 0, activeProgramDayDate: "2026-06-01" };
    const { result } = await renderActive();

    await waitFor(() => expect(result.current.activeProgram).toBeDefined());
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });
});

describe("changing the selection", () => {
  test("selecting a program starts it at day 0 today and reports it", async () => {
    const { result } = await renderActive();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.selectProgram("full"));

    await waitFor(() => expect(result.current.activeProgram?.id).toBe("full"));
    expect(mockUpdateUserSettings).toHaveBeenCalledWith({
      activeProgramId: "full",
      activeProgramDay: 0,
      activeProgramDayDate: TODAY,
    });
    expect(mockLogEvent).toHaveBeenCalledWith("program_selected", {});
  });

  test("jumping to a day keeps the anchor date", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 0, activeProgramDayDate: TODAY };
    const { result } = await renderActive();
    await waitFor(() => expect(result.current.activeProgram).toBeDefined());

    await act(() => result.current.selectProgramDay(2));

    await waitFor(() => expect(result.current.programDay).toBe(2));
    expect(mockUpdateUserSettings).toHaveBeenCalledWith({ activeProgramDay: 2 });
  });

  test("removing the selection clears the id with an empty string", async () => {
    storedSettings = { measure: "kg", activeProgramId: "ppl", activeProgramDay: 1, activeProgramDayDate: TODAY };
    const { result } = await renderActive();
    await waitFor(() => expect(result.current.activeProgram).toBeDefined());

    await act(() => result.current.removeProgramSelection());

    await waitFor(() => expect(result.current.activeProgram).toBeUndefined());
    expect(mockUpdateUserSettings).toHaveBeenCalledWith({
      activeProgramId: "",
      activeProgramDay: 0,
      activeProgramDayDate: TODAY,
    });
  });

  test("a failed selection goes to the error handler and reports nothing", async () => {
    const error = new Error("permission-denied");
    mockUpdateUserSettings.mockRejectedValue(error);
    const { result } = await renderActive();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.selectProgram("ppl"));

    await waitFor(() => expect(mockHandleMutationError).toHaveBeenCalledWith(error));
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});
