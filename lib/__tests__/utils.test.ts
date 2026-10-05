import { computeProgramDay } from "../utils";

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

/** Local noon on 10 June 2026. */
const TODAY = new Date(2026, 5, 10, 12);

const program = (dayCount: number) => ({
  id: "p1",
  name: "Program",
  days: Array.from({ length: dayCount }, () => ({ isRestDay: true })),
});

const settings = (activeProgramDay?: number, activeProgramDayDate?: string) => ({
  measure: "kg" as const,
  activeProgramId: "p1",
  ...(activeProgramDay !== undefined && { activeProgramDay }),
  ...(activeProgramDayDate !== undefined && { activeProgramDayDate }),
});

beforeEach(() => {
  jest.useFakeTimers({ now: TODAY });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("computeProgramDay", () => {
  test("is undefined before settings have loaded", () => {
    expect(computeProgramDay(undefined, program(3))).toBeUndefined();
  });

  test("returns the stored day while the program is still loading", () => {
    expect(computeProgramDay(settings(2, "2026-06-01"), undefined)).toBe(2);
  });

  test("returns the stored day for a program with no days", () => {
    expect(computeProgramDay(settings(2, "2026-06-01"), program(0))).toBe(2);
  });

  test("returns the stored day when no anchor date was recorded", () => {
    expect(computeProgramDay(settings(1), program(3))).toBe(1);
  });

  test("is undefined when no day was ever chosen", () => {
    expect(computeProgramDay(settings(undefined, "2026-06-01"), program(3))).toBeUndefined();
  });

  test("stays on the stored day on the day it was chosen", () => {
    expect(computeProgramDay(settings(1, "2026-06-10"), program(3))).toBe(1);
  });

  test("moves forward one day per calendar day", () => {
    expect(computeProgramDay(settings(0, "2026-06-09"), program(7))).toBe(1);
    expect(computeProgramDay(settings(0, "2026-06-07"), program(7))).toBe(3);
  });

  test("wraps around to the first day after the last one", () => {
    expect(computeProgramDay(settings(2, "2026-06-09"), program(3))).toBe(0);
  });

  test("wraps many times over a long absence", () => {
    // 365 days later on a 7-day program: 365 % 7 = 1.
    expect(computeProgramDay(settings(0, "2025-06-10"), program(7))).toBe(1);
  });

  test("crosses a month and a leap day correctly", () => {
    jest.setSystemTime(new Date(2028, 2, 1, 12));

    // 2028-02-28 -> 2028-03-01 is two days because of 29 February.
    expect(computeProgramDay(settings(0, "2028-02-28"), program(7))).toBe(2);
  });

  test("does not move backwards when the anchor date is in the future", () => {
    // A phone whose clock was changed, or a date written by another device.
    expect(computeProgramDay(settings(2, "2026-06-20"), program(3))).toBe(2);
  });

  test("brings an out-of-range stored day back into range once a day passes", () => {
    // The program was edited down from 6 days to 3 while day 5 was active.
    expect(computeProgramDay(settings(5, "2026-06-09"), program(3))).toBe(0);
  });

  test("returns an out-of-range stored day as-is on the same day", () => {
    // Callers must guard against this until the next day rolls it over.
    expect(computeProgramDay(settings(5, "2026-06-10"), program(3))).toBe(5);
  });

  test("a one-day program is always on day 0 after any elapsed time", () => {
    expect(computeProgramDay(settings(0, "2026-06-01"), program(1))).toBe(0);
  });
});
