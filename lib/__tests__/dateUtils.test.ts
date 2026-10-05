import {
  daysBetween,
  findMostRecentSessionDate,
  formatDateAsString,
  getISOWeek,
  getPreviousWeek,
  getTodayString,
  timestampToMillis,
} from "../dateUtils";

describe("findMostRecentSessionDate", () => {
  test("returns the most recent date when several are before today", () => {
    // Arrange
    const dates = ["2026-05-01", "2026-05-20", "2026-05-10"];
    const today = "2026-06-01";

    // Act
    const result = findMostRecentSessionDate(dates, today);

    // Assert
    expect(result).toBe("2026-05-20");
  });

  test("ignores a date equal to today (must be strictly before)", () => {
    const dates = ["2026-05-20", "2026-06-01"];
    const today = "2026-06-01";

    const result = findMostRecentSessionDate(dates, today);

    expect(result).toBe("2026-05-20");
  });

  test("ignores future dates", () => {
    const dates = ["2026-05-20", "2026-07-15"];
    const today = "2026-06-01";

    const result = findMostRecentSessionDate(dates, today);

    expect(result).toBe("2026-05-20");
  });

  test("returns null for an empty array", () => {
    const result = findMostRecentSessionDate([], "2026-06-01");

    expect(result).toBeNull();
  });

  test("returns null when every date is today or in the future", () => {
    const dates = ["2026-06-01", "2026-06-10"];
    const today = "2026-06-01";

    const result = findMostRecentSessionDate(dates, today);

    expect(result).toBeNull();
  });

  test("does not mutate the input array", () => {
    const dates = ["2026-05-01", "2026-05-20", "2026-05-10"];

    findMostRecentSessionDate(dates, "2026-06-01");

    expect(dates).toEqual(["2026-05-01", "2026-05-20", "2026-05-10"]);
  });

  test("returns the correct date even when input is unsorted", () => {
    const dates = ["2026-05-30", "2026-05-02", "2026-05-28", "2026-05-15"];
    const today = "2026-06-01";

    const result = findMostRecentSessionDate(dates, today);

    expect(result).toBe("2026-05-30");
  });
});

describe("formatDateAsString", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("formats a non-today date as 'Nth of Month YYYY'", () => {
    expect(formatDateAsString("2026-06-15")).toBe("15th of June 2026");
  });

  test("uses 'st' for the 1st", () => {
    expect(formatDateAsString("2026-01-01")).toBe("1st of January 2026");
  });

  test("uses 'nd' for the 2nd", () => {
    expect(formatDateAsString("2026-01-02")).toBe("2nd of January 2026");
  });

  test("uses 'rd' for the 3rd", () => {
    expect(formatDateAsString("2026-01-03")).toBe("3rd of January 2026");
  });

  test("uses 'th' for the 11th (the teens are special)", () => {
    expect(formatDateAsString("2026-01-11")).toBe("11th of January 2026");
  });

  test("uses 'st' again for the 21st", () => {
    expect(formatDateAsString("2026-01-21")).toBe("21st of January 2026");
  });
});

describe("getPreviousWeek", () => {
  test("decrements the week number within the same year", () => {
    expect(getPreviousWeek("2026-W15")).toBe("2026-W14");
  });

  test("pads single-digit week numbers to two digits", () => {
    expect(getPreviousWeek("2026-W10")).toBe("2026-W09");
  });

  test("wraps W01 back to the last week of the previous year", () => {
    expect(getPreviousWeek("2026-W01")).toBe("2025-W52");
  });
});

describe("getISOWeek", () => {
  test.each([
    // [local date, ISO week] — the year boundary is where ISO weeks bite.
    [[2020, 11, 31], "2020-W53"], // Thursday in a 53-week year
    [[2021, 0, 3], "2020-W53"], // Sunday 3 Jan still belongs to last year
    [[2021, 0, 4], "2021-W01"], // the first Monday starts week 1
    [[2024, 11, 30], "2025-W01"], // late December can be next year's week 1
    [[2025, 11, 28], "2025-W52"],
    [[2026, 0, 1], "2026-W01"], // a Thursday is always in week 1
    [[2027, 0, 1], "2026-W53"], // 2026 has 53 weeks
    [[2027, 0, 4], "2027-W01"],
    [[2028, 1, 29], "2028-W09"], // leap day
  ] as const)("puts %p in %s", ([year, month, day], week) => {
    expect(getISOWeek(new Date(year, month, day, 12))).toBe(week);
  });

  test("treats Monday 00:00 and Sunday 23:59 as different weeks", () => {
    expect(getISOWeek(new Date(2026, 5, 14, 23, 59, 59))).toBe("2026-W24");
    expect(getISOWeek(new Date(2026, 5, 15, 0, 0, 0))).toBe("2026-W25");
  });

  test("does not modify the date it is given", () => {
    const date = new Date(2026, 5, 10, 15, 30);
    const before = date.getTime();

    getISOWeek(date);

    expect(date.getTime()).toBe(before);
  });
});

describe("getPreviousWeek (year boundaries)", () => {
  test("goes back from W01 to W53 when the previous year had 53 weeks", () => {
    expect(getPreviousWeek("2021-W01")).toBe("2020-W53");
    expect(getPreviousWeek("2027-W01")).toBe("2026-W53");
  });

  test("goes back from W01 to W52 in an ordinary year", () => {
    expect(getPreviousWeek("2026-W01")).toBe("2025-W52");
  });

  test("goes back from W53 to W52", () => {
    expect(getPreviousWeek("2026-W53")).toBe("2026-W52");
  });

  test("round-trips with getISOWeek for every week of a year", () => {
    let date = new Date(2026, 0, 5, 12); // Monday of 2026-W02
    while (date.getFullYear() < 2027) {
      const lastWeek = new Date(date);
      lastWeek.setDate(date.getDate() - 7);

      expect(getPreviousWeek(getISOWeek(date))).toBe(getISOWeek(lastWeek));

      date = new Date(date);
      date.setDate(date.getDate() + 7);
    }
  });
});

describe("daysBetween", () => {
  test.each([
    ["2026-06-10", "2026-06-10", 0],
    ["2026-06-10", "2026-06-11", 1],
    ["2026-06-11", "2026-06-10", -1],
    ["2028-02-28", "2028-03-01", 2], // leap year
    ["2027-02-28", "2027-03-01", 1],
    ["2026-12-31", "2027-01-01", 1],
    ["2026-01-01", "2027-01-01", 365],
    ["2028-01-01", "2029-01-01", 366],
  ])("from %s to %s is %i", (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  test("returns NaN for something that is not a date", () => {
    expect(daysBetween("yesterday", "2026-06-10")).toBeNaN();
  });
});

describe("timestampToMillis", () => {
  const MS = 1_780_000_000_000;

  test.each([
    ["a Date", new Date(MS)],
    ["a number", MS],
    ["an ISO string", new Date(MS).toISOString()],
    ["a Timestamp-like object with toMillis", { toMillis: () => MS }],
    ["an object with only toDate", { toDate: () => new Date(MS) }],
  ])("reads %s", (_name, value) => {
    expect(timestampToMillis(value)).toBe(MS);
  });

  test("prefers toMillis when both are present", () => {
    expect(timestampToMillis({ toMillis: () => 1, toDate: () => new Date(2) })).toBe(1);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an unparseable string", "not a date"],
    ["a plain object", { seconds: 5 }],
    ["a boolean", true],
  ])("reads %s as 0", (_name, value) => {
    expect(timestampToMillis(value)).toBe(0);
  });

  test("keeps the epoch itself as 0 and negative times as negative", () => {
    expect(timestampToMillis(new Date(0))).toBe(0);
    expect(timestampToMillis(-1000)).toBe(-1000);
  });
});

describe("getTodayString", () => {
  afterEach(() => jest.useRealTimers());

  test("formats the local date as YYYY-MM-DD", () => {
    jest.useFakeTimers({ now: new Date(2026, 0, 5, 9) });

    expect(getTodayString()).toBe("2026-01-05");
  });

  test("still says today one millisecond before local midnight", () => {
    jest.useFakeTimers({ now: new Date(2026, 11, 31, 23, 59, 59, 999) });

    expect(getTodayString()).toBe("2026-12-31");
  });

  test("rolls to the new year at local midnight", () => {
    jest.useFakeTimers({ now: new Date(2027, 0, 1, 0, 0, 0, 0) });

    expect(getTodayString()).toBe("2027-01-01");
  });
});

describe("formatDateAsString (more ordinals)", () => {
  test.each([
    ["2026-06-12", "12th of June 2026"],
    ["2026-06-13", "13th of June 2026"],
    ["2026-06-22", "22nd of June 2026"],
    ["2026-06-23", "23rd of June 2026"],
    ["2026-05-31", "31st of May 2026"],
    ["2028-02-29", "29th of February 2028"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatDateAsString(input)).toBe(expected);
  });
});
