/**
 * Date logic that must hold in EVERY time zone a user can be in.
 *
 * `npm test` runs this under UTC only. `npm run test:tz` re-runs it under
 * zones east and west of UTC, with and without daylight saving, because a
 * time zone can only be chosen when the Node process starts.
 */
import {
  daysBetween,
  formatDateAsString,
  getISOWeek,
  getTodayString,
} from "../dateUtils";
import { computeProgramDay } from "../utils";

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Positive getTimezoneOffset means the zone is behind UTC (the Americas). */
const isWestOfUtc = new Date(2026, 5, 1).getTimezoneOffset() > 0;

afterEach(() => {
  jest.useRealTimers();
});

describe(`dates in ${zone}`, () => {
  test("whole calendar months are whole days apart across both DST changes", () => {
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  test("each night of a DST weekend is exactly one day", () => {
    // Covers the European (last Sunday of March/October) and US (second
    // Sunday of March, first of November) switchovers.
    for (const [from, to] of [
      ["2026-03-07", "2026-03-08"],
      ["2026-03-08", "2026-03-09"],
      ["2026-03-28", "2026-03-29"],
      ["2026-03-29", "2026-03-30"],
      ["2026-10-24", "2026-10-25"],
      ["2026-10-25", "2026-10-26"],
      ["2026-10-31", "2026-11-01"],
      ["2026-11-01", "2026-11-02"],
    ]) {
      expect(daysBetween(from, to)).toBe(1);
    }
  });

  test("a program advances one day per night over a DST weekend", () => {
    jest.useFakeTimers({ now: new Date(2026, 2, 30, 12) });

    const day = computeProgramDay(
      { measure: "kg", activeProgramDay: 0, activeProgramDayDate: "2026-03-28" },
      { id: "p", name: "P", days: Array.from({ length: 7 }, () => ({ isRestDay: true })) },
    );

    expect(day).toBe(2);
  });

  test("'today' is the local calendar day, not the UTC one", () => {
    // 00:30 local is still "yesterday" in UTC for every zone east of it.
    jest.useFakeTimers({ now: new Date(2026, 5, 10, 0, 30) });
    expect(getTodayString()).toBe("2026-06-10");

    // 23:30 local is already "tomorrow" in UTC for every zone west of it.
    jest.useFakeTimers({ now: new Date(2026, 5, 10, 23, 30) });
    expect(getTodayString()).toBe("2026-06-10");
  });

  test("the ISO week of a local Monday morning is that week", () => {
    expect(getISOWeek(new Date(2026, 5, 15, 0, 30))).toBe("2026-W25");
    expect(getISOWeek(new Date(2026, 5, 14, 23, 30))).toBe("2026-W24");
  });

  // FIXME: west of UTC, formatDateAsString parses "YYYY-MM-DD" with
  // new Date(string), which is UTC midnight, then reads it back in local time
  // — so in New York "2026-06-01" prints as "31st of May 2026".
  (isWestOfUtc ? test.failing : test)(
    "formats a stored date as that same calendar day",
    () => {
      jest.useFakeTimers({ now: new Date(2026, 5, 20, 12) });

      expect(formatDateAsString("2026-06-01")).toBe("1st of June 2026");
      expect(formatDateAsString("2027-01-01")).toBe("1st of January 2027");
    },
  );
});
