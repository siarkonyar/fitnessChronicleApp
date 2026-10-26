import {
  ChatMessageSchema,
  DaySchema,
  ExerciseLogSchema,
  ExerciseLogWithIdSchema,
  LabelSchema,
  ProgramDaySchema,
  ProgramSchema,
  SetSchema,
  SubscriptionTierSchema,
  UserProfileSchema,
  UserSettingsSchema,
  WeightSchema,
} from "../types";

class MockTimestamp {
  constructor(private readonly date: Date) {}
  toDate(): Date {
    return this.date;
  }
}

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  get Timestamp() {
    return MockTimestamp;
  },
}));

const log = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-06-10",
  activity: "squat",
  sets: [{ measure: "kg", setType: "normal", value: "100", reps: "5" }],
  ...overrides,
});

describe("SetSchema", () => {
  test.each(["warmup", "normal", "failure", "drop", "pr", "failedpr"])(
    "accepts a %s set for weights",
    (setType) => {
      expect(SetSchema.safeParse({ measure: "kg", setType }).success).toBe(true);
      expect(SetSchema.safeParse({ measure: "lbs", setType }).success).toBe(true);
    },
  );

  test.each(["drop", "failedpr"])(
    "rejects a %s set for time, distance and steps",
    (setType) => {
      for (const measure of ["time", "distance", "steps"]) {
        expect(SetSchema.safeParse({ measure, setType }).success).toBe(false);
      }
    },
  );

  test("silently drops reps from a timed set", () => {
    expect(SetSchema.parse({ measure: "time", setType: "normal", value: "60", reps: "5" })).toEqual({
      measure: "time",
      setType: "normal",
      value: "60",
    });
  });

  test("rejects the old 'step' spelling of steps", () => {
    expect(SetSchema.safeParse({ measure: "step", setType: "normal" }).success).toBe(false);
  });

  test("keeps value and reps as strings, so '' and '0' are allowed", () => {
    expect(SetSchema.safeParse({ measure: "kg", setType: "normal", value: "", reps: "0" }).success).toBe(true);
    expect(SetSchema.safeParse({ measure: "kg", setType: "normal", value: 100 }).success).toBe(false);
  });
});

describe("ExerciseLogSchema", () => {
  test.each([
    ["ab", false],
    ["abc", true],
    ["a".repeat(100), true],
    ["a".repeat(101), false],
  ])("activity %p valid: %p", (activity, valid) => {
    expect(ExerciseLogSchema.safeParse(log({ activity })).success).toBe(valid);
  });

  test("allows notes up to 500 characters", () => {
    expect(ExerciseLogSchema.safeParse(log({ notes: "n".repeat(500) })).success).toBe(true);
    expect(ExerciseLogSchema.safeParse(log({ notes: "n".repeat(501) })).success).toBe(false);
  });

  test("requires whole calories", () => {
    expect(ExerciseLogSchema.safeParse(log({ caloriesBurned: 250 })).success).toBe(true);
    expect(ExerciseLogSchema.safeParse(log({ caloriesBurned: 250.5 })).success).toBe(false);
  });

  test("allows a log with no sets", () => {
    expect(ExerciseLogSchema.safeParse(log({ sets: [] })).success).toBe(true);
  });

  test("does not validate the date format at all", () => {
    // Pinned: unlike labels, a log's date is any string.
    expect(ExerciseLogSchema.safeParse(log({ date: "next tuesday" })).success).toBe(true);
  });

  test("accepts a JS Date for createdAt", () => {
    const createdAt = new Date("2026-06-10T08:00:00Z");

    expect(ExerciseLogSchema.parse(log({ createdAt })).createdAt).toEqual(createdAt);
  });

  test("converts a Firestore Timestamp createdAt into a Date", () => {
    const createdAt = new Date("2026-06-10T08:00:00Z");

    expect(
      ExerciseLogSchema.parse(log({ createdAt: new MockTimestamp(createdAt) })).createdAt,
    ).toEqual(createdAt);
  });

  test.each([["2026-06-10"], [1_780_000_000_000], [{ seconds: 1, nanoseconds: 0 }]])(
    "rejects a createdAt of %p",
    (createdAt) => {
      expect(ExerciseLogSchema.safeParse(log({ createdAt })).success).toBe(false);
    },
  );

  test("the WithId variant requires the document id", () => {
    expect(ExerciseLogWithIdSchema.safeParse(log()).success).toBe(false);
    expect(ExerciseLogWithIdSchema.safeParse(log({ id: "abc" })).success).toBe(true);
  });
});

describe("LabelSchema", () => {
  test("defaults missing dates to an empty list", () => {
    expect(LabelSchema.parse({ label: "💪", description: "Push" }).dates).toEqual([]);
  });

  test("fits a family emoji, which is 11 UTF-16 units long", () => {
    expect(LabelSchema.safeParse({ label: "👨‍👩‍👧‍👦", description: "Family" }).success).toBe(true);
  });

  test.each([
    ["", "Push", false],
    ["x".repeat(51), "Push", false],
    ["x", "", false],
    ["x", "d".repeat(101), false],
    ["x".repeat(50), "d".repeat(100), true],
  ])("label %p / description %p valid: %p", (label, description, valid) => {
    expect(LabelSchema.safeParse({ label, description }).success).toBe(valid);
  });

  test.each([
    ["2028-02-29", true],
    ["2026-02-29", false],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["2026-6-1", false],
    ["2026-06-10T00:00:00Z", false],
  ])("assigned date %p valid: %p", (date, valid) => {
    expect(LabelSchema.safeParse({ label: "x", description: "y", dates: [date] }).success).toBe(valid);
  });
});

describe("DaySchema", () => {
  test("needs a real date and a non-empty label id", () => {
    expect(DaySchema.safeParse({ date: "2026-06-10", labelId: "push" }).success).toBe(true);
    expect(DaySchema.safeParse({ date: "2026-06-10", labelId: "" }).success).toBe(false);
    expect(DaySchema.safeParse({ date: "10/06/2026", labelId: "push" }).success).toBe(false);
  });
});

describe("ProgramSchema", () => {
  test("requires a name but allows an empty schedule", () => {
    expect(ProgramSchema.safeParse({ name: "P", days: [] }).success).toBe(true);
    expect(ProgramSchema.safeParse({ name: "", days: [] }).success).toBe(false);
  });

  test("a rest day needs nothing but the flag", () => {
    expect(ProgramDaySchema.safeParse({ isRestDay: true }).success).toBe(true);
    expect(ProgramDaySchema.safeParse({}).success).toBe(false);
  });

  test("rejects a program exercise with a too-short name", () => {
    expect(
      ProgramDaySchema.safeParse({ isRestDay: false, exercises: [{ activity: "ab", sets: [] }] }).success,
    ).toBe(false);
  });
});

describe("WeightSchema", () => {
  test("requires a numeric weight", () => {
    expect(WeightSchema.safeParse({ weight: 80, date: "2026-06-10" }).success).toBe(true);
    expect(WeightSchema.safeParse({ weight: "80", date: "2026-06-10" }).success).toBe(false);
  });

  test("does not reject zero or negative weights", () => {
    // Pinned: the entry modal is the only guard against these.
    expect(WeightSchema.safeParse({ weight: 0, date: "d" }).success).toBe(true);
    expect(WeightSchema.safeParse({ weight: -5, date: "d" }).success).toBe(true);
  });
});

describe("UserSettingsSchema", () => {
  test("requires a known unit", () => {
    expect(UserSettingsSchema.safeParse({}).success).toBe(false);
    expect(UserSettingsSchema.safeParse({ measure: "stone" }).success).toBe(false);
  });

  test.each([
    [0, true],
    [6, true],
    [-1, false],
    [1.5, false],
  ])("activeProgramDay %p valid: %p", (activeProgramDay, valid) => {
    expect(UserSettingsSchema.safeParse({ measure: "kg", activeProgramDay }).success).toBe(valid);
  });
});

describe("UserProfileSchema", () => {
  test("everything is optional", () => {
    expect(UserProfileSchema.parse({})).toEqual({});
  });

  test("rejects an empty or very long name", () => {
    expect(UserProfileSchema.safeParse({ name: "" }).success).toBe(false);
    expect(UserProfileSchema.safeParse({ name: "n".repeat(101) }).success).toBe(false);
  });

  test("requires the birthday to be a real ISO date", () => {
    expect(UserProfileSchema.safeParse({ birthday: "2000-02-29" }).success).toBe(true);
    expect(UserProfileSchema.safeParse({ birthday: "2001-02-29" }).success).toBe(false);
  });
});

describe("SubscriptionTierSchema and ChatMessageSchema", () => {
  test("knows exactly the three tiers", () => {
    expect(SubscriptionTierSchema.options).toEqual(["free", "pro", "max"]);
  });

  test("a chat message may carry a proposed program", () => {
    const parsed = ChatMessageSchema.parse({
      role: "model",
      text: "Try this",
      program: { name: "PPL", days: [{ isRestDay: true }] },
    });

    expect(parsed.program?.name).toBe("PPL");
  });

  test("rejects a chat role other than user or model", () => {
    expect(ChatMessageSchema.safeParse({ role: "system", text: "x" }).success).toBe(false);
  });
});
