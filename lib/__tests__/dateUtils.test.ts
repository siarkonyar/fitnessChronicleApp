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
});
