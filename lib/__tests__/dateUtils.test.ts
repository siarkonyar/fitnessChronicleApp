import { findMostRecentSessionDate } from "../dateUtils";

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
