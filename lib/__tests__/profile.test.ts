import {
  GENDER_OPTIONS,
  MINIMUM_AGE_YEARS,
  calculateAge,
  formatDisplayBirthday,
  isUnderMinimumAge,
  genderLabel,
  isProfileComplete,
  toIsoBirthday,
  validateBirthday,
} from "../profile";

describe("isProfileComplete", () => {
  test("is complete when both name and gender are set", () => {
    expect(isProfileComplete({ name: "Alex", gender: "female" })).toBe(true);
  });

  test("ignores birthday, which is optional", () => {
    // Arrange: no birthday at all, versus one that is present.
    const withoutBirthday = { name: "Alex", gender: "male" as const };
    const withBirthday = { ...withoutBirthday, birthday: "1998-06-05" };

    // Act + Assert
    expect(isProfileComplete(withoutBirthday)).toBe(true);
    expect(isProfileComplete(withBirthday)).toBe(true);
  });

  test("is incomplete when the name is missing", () => {
    expect(isProfileComplete({ gender: "male" })).toBe(false);
  });

  test("is incomplete when the gender is missing", () => {
    expect(isProfileComplete({ name: "Alex" })).toBe(false);
  });

  test("treats a whitespace-only name as missing", () => {
    expect(isProfileComplete({ name: "   ", gender: "male" })).toBe(false);
  });

  test("is incomplete for a brand-new user with no profile document", () => {
    // getUserProfile returns {} when the Firestore doc does not parse.
    expect(isProfileComplete({})).toBe(false);
  });
});

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

describe("calculateAge and the minimum-age gate", () => {
  const at = (year: number, month: number, day: number) =>
    jest.useFakeTimers({ now: new Date(year, month - 1, day, 12) });

  afterEach(() => jest.useRealTimers());

  test("the minimum age is 13", () => {
    expect(MINIMUM_AGE_YEARS).toBe(13);
  });

  test("turns 13 on the birthday itself, not the day after", () => {
    at(2026, 6, 10);

    expect(calculateAge("10", "06", "2013")).toBe(13);
    expect(isUnderMinimumAge("10", "06", "2013")).toBe(false);
  });

  test("is still 12 the day before the 13th birthday", () => {
    at(2026, 6, 10);

    expect(calculateAge("11", "06", "2013")).toBe(12);
    expect(isUnderMinimumAge("11", "06", "2013")).toBe(true);
  });

  test("counts completed years, not the difference between years", () => {
    // Born on New Year's Eve: 2025 - 2012 = 13, but they are 12 until Dec 31.
    at(2025, 12, 30);
    expect(calculateAge("31", "12", "2012")).toBe(12);

    at(2025, 12, 31);
    expect(calculateAge("31", "12", "2012")).toBe(13);
  });

  test("a 29 February birthday counts from 1 March in a non-leap year", () => {
    at(2025, 2, 28);
    expect(isUnderMinimumAge("29", "02", "2012")).toBe(true);

    at(2025, 3, 1);
    expect(isUnderMinimumAge("29", "02", "2012")).toBe(false);
  });

  test("a 29 February birthday counts on the day in a leap year", () => {
    at(2028, 2, 29);

    expect(calculateAge("29", "02", "2012")).toBe(16);
  });

  test("accepts unpadded day and month", () => {
    at(2026, 6, 10);

    expect(calculateAge("1", "1", "2000")).toBe(26);
  });

  test("a birthday later this year passes validation but fails the age gate", () => {
    at(2026, 6, 10);

    expect(validateBirthday("31", "12", "2026")).toBeNull();
    expect(calculateAge("31", "12", "2026")).toBe(-1);
    expect(isUnderMinimumAge("31", "12", "2026")).toBe(true);
  });

  test("a centenarian is not under age", () => {
    at(2026, 6, 10);

    expect(isUnderMinimumAge("01", "01", "1920")).toBe(false);
  });
});

describe("validateBirthday (input oddities)", () => {
  test("accepts digits followed by junk, because parseInt stops at the junk", () => {
    // Pinned: the onboarding inputs are numeric-only, so this cannot be typed.
    expect(validateBirthday("12abc", "6", "2000")).toBeNull();
  });

  test.each([
    ["0", "6", "2000", "Day must be between 01 and 31."],
    ["32", "6", "2000", "Day must be between 01 and 31."],
    ["-1", "6", "2000", "Day must be between 01 and 31."],
    ["x", "6", "2000", "Day must be between 01 and 31."],
    ["1", "0", "2000", "Month must be between 01 and 12."],
    ["1", "13", "2000", "Month must be between 01 and 12."],
    ["31", "4", "2000", "Invalid date."],
    ["29", "2", "1900", "Invalid date."], // 1900 is not a leap year
  ])("rejects %s/%s/%s", (day, month, year, message) => {
    expect(validateBirthday(day, month, year)).toBe(message);
  });

  test("accepts 29 February 2000, a leap year divisible by 400", () => {
    expect(validateBirthday("29", "2", "2000")).toBeNull();
  });

  test("accepts the earliest allowed year and rejects the one before", () => {
    expect(validateBirthday("1", "1", "1900")).toBeNull();
    expect(validateBirthday("31", "12", "1899")).toMatch(/^Year must be between 1900/);
  });
});
