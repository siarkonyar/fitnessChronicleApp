import {
  GENDER_OPTIONS,
  formatDisplayBirthday,
  genderLabel,
  toIsoBirthday,
  validateBirthday,
} from "../profile";

describe("genderLabel", () => {
  test("returns the readable label for every known gender value", () => {
    // Arrange
    const values = GENDER_OPTIONS.map((option) => option.value);

    // Act
    const labels = values.map(genderLabel);

    // Assert
    expect(labels).toEqual([
      "Male",
      "Female",
      "Non-binary",
      "Prefer not to say",
    ]);
  });

  test("falls back to the raw value when it is not a known option", () => {
    expect(genderLabel("martian")).toBe("martian");
  });
});

describe("validateBirthday", () => {
  test("returns null for a valid date", () => {
    expect(validateBirthday("15", "06", "1998")).toBeNull();
  });

  test("accepts unpadded day and month", () => {
    expect(validateBirthday("5", "6", "1998")).toBeNull();
  });

  test("reports missing fields", () => {
    expect(validateBirthday("", "06", "1998")).toBe(
      "Please fill in all fields.",
    );
    expect(validateBirthday("15", "", "1998")).toBe(
      "Please fill in all fields.",
    );
    expect(validateBirthday("15", "06", "")).toBe("Please fill in all fields.");
  });

  test("rejects an out-of-range day", () => {
    expect(validateBirthday("32", "06", "1998")).toBe(
      "Day must be between 01 and 31.",
    );
    expect(validateBirthday("0", "06", "1998")).toBe(
      "Day must be between 01 and 31.",
    );
  });

  test("rejects an out-of-range month", () => {
    expect(validateBirthday("15", "13", "1998")).toBe(
      "Month must be between 01 and 12.",
    );
  });

  test("rejects a year before 1900 or in the future", () => {
    const nextYear = new Date().getFullYear() + 1;

    expect(validateBirthday("15", "06", "1899")).toMatch(
      /^Year must be between/,
    );
    expect(validateBirthday("15", "06", String(nextYear))).toMatch(
      /^Year must be between/,
    );
  });

  test("rejects a day that does not exist in that month", () => {
    // Arrange: 2023 is not a leap year, so Feb 29 does not exist.
    // Act
    const error = validateBirthday("29", "02", "2023");

    // Assert
    expect(error).toBe("Invalid date.");
  });

  test("accepts Feb 29 in a leap year", () => {
    expect(validateBirthday("29", "02", "2024")).toBeNull();
  });
});

describe("toIsoBirthday", () => {
  test("zero-pads day and month into an ISO date", () => {
    expect(toIsoBirthday("5", "6", "1998")).toBe("1998-06-05");
  });

  test("leaves already-padded values alone", () => {
    expect(toIsoBirthday("15", "12", "1998")).toBe("1998-12-15");
  });
});

describe("formatDisplayBirthday", () => {
  test("renders an ISO date as DD / MM / YYYY", () => {
    expect(formatDisplayBirthday("1998-06-05")).toBe("05 / 06 / 1998");
  });
});
