import { getStreak, updateStreak } from "../streaks";
import {
  TEST_UID,
  readDoc,
  resetFirestore,
  seedDoc,
} from "./firestoreTestUtils";

jest.mock("@react-native-firebase/firestore", () =>
  require("./firestoreTestUtils"),
);

let mockCurrentUser: { uid: string } | null = { uid: "test-user" };
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: mockCurrentUser }),
}));

const USER = ["users", TEST_UID];

/** 2026-06-10 is a Wednesday in ISO week 2026-W24. */
const WEDNESDAY_W24 = new Date("2026-06-10T12:00:00Z");

beforeEach(() => {
  resetFirestore();
  mockCurrentUser = { uid: TEST_UID };
});

describe("updateStreak", () => {
  test("keeps the streak when the user logged this week", async () => {
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2026-W24" });

    await updateStreak(WEDNESDAY_W24);

    expect(readDoc(USER)?.streakWeeks).toBe(6);
  });

  test("keeps the streak while this week can still be saved", async () => {
    // Logged last week, not yet this week: the streak is alive until Sunday.
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2026-W23" });

    await updateStreak(WEDNESDAY_W24);

    expect(readDoc(USER)?.streakWeeks).toBe(6);
  });

  test("breaks the streak once a whole week was missed", async () => {
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2026-W22", measure: "kg" });

    await updateStreak(WEDNESDAY_W24);

    expect(readDoc(USER)).toEqual({ streakWeeks: 0, lastLoggedWeek: "2026-W22", measure: "kg" });
  });

  test("keeps a streak from week 53 alive into the next year's week 1", async () => {
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2026-W53" });

    await updateStreak(new Date("2027-01-06T12:00:00Z"));

    expect(readDoc(USER)?.streakWeeks).toBe(6);
  });

  test("breaks a streak whose last log was a whole year ago in the same week number", async () => {
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2025-W24" });

    await updateStreak(WEDNESDAY_W24);

    expect(readDoc(USER)?.streakWeeks).toBe(0);
  });

  test("writes a zero streak for a user who never logged", async () => {
    await updateStreak(WEDNESDAY_W24);

    expect(readDoc(USER)).toEqual({ streakWeeks: 0 });
  });

  test("requires a signed-in user", async () => {
    mockCurrentUser = null;

    await expect(updateStreak(WEDNESDAY_W24)).rejects.toThrow("User not authenticated");
  });
});

describe("getStreak", () => {
  test("returns the stored number of weeks", async () => {
    seedDoc(USER, { streakWeeks: 11 });

    expect(await getStreak()).toBe(11);
  });

  test("returns 0 for a user with no document", async () => {
    expect(await getStreak()).toBe(0);
  });

  test("returns 0 for a user document without a streak", async () => {
    seedDoc(USER, { measure: "kg" });

    expect(await getStreak()).toBe(0);
  });

  test.each([["11"], [null], [true], [{ weeks: 3 }]])(
    "returns 0 when the stored streak is %p instead of a number",
    async (value) => {
      seedDoc(USER, { streakWeeks: value });

      expect(await getStreak()).toBe(0);
    },
  );

  test("does not read the streak as stale on its own", async () => {
    // getStreak only reports; updateStreak is what zeroes a dead streak, so
    // reading without updating first can show an expired number.
    seedDoc(USER, { streakWeeks: 6, lastLoggedWeek: "2020-W01" });

    expect(await getStreak()).toBe(6);
  });
});
