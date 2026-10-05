/**
 * Contracts between the app and things it cannot import at runtime: the
 * Cloud Functions codebase, firebase.json, and its own parallel constants.
 *
 * Each of these has drifted, or been one edit from drifting, before. A
 * mismatch here is silent in production — calls land in a region with no
 * functions, a proposed program picks a rep bucket the picker cannot show —
 * so the check runs on every `npm test` instead.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Colors } from "../Colors";
import { FUNCTIONS_REGION } from "../firebase";
import { queryKeys } from "../QueryKeys";
import { REP_RANGE_OPTIONS } from "../RepRanges";
import { TIER_CONFIG } from "../subscriptionTiers";
import { REP_RANGE_OPTIONS as SERVER_REP_RANGE_OPTIONS } from "../../functions/src/ai/repRanges";
import { SubscriptionTierSchema } from "../../types/types";

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** The single capture group of `pattern` in `path`, or a failing test. */
const extract = (path: string, pattern: RegExp): string => {
  const match = read(path).match(pattern);
  if (!match) throw new Error(`${pattern} not found in ${path}`);
  return match[1];
};

describe("app ↔ Cloud Functions", () => {
  test("the app calls the region the functions are deployed to", () => {
    const serverRegion = extract("functions/src/index.ts", /export const REGION = "([^"]+)"/);

    expect(FUNCTIONS_REGION).toBe(serverRegion);
  });

  test("the coach proposes rep ranges from the picker's exact list, in order", () => {
    expect([...SERVER_REP_RANGE_OPTIONS]).toEqual([...REP_RANGE_OPTIONS]);
  });

  test("the app and the quota code know the same tiers", () => {
    const serverTiers = extract("functions/src/quota/caps.ts", /export type Tier = ([^;]+);/)
      .split("|")
      .map((tier) => tier.trim().replace(/"/g, ""));

    expect(SubscriptionTierSchema.options).toEqual(serverTiers);
  });
});

describe("app ↔ firebase.json", () => {
  const emulators = JSON.parse(read("firebase.json")).emulators;

  test.each([
    ["AUTH_EMULATOR_PORT", "auth"],
    ["FIRESTORE_EMULATOR_PORT", "firestore"],
    ["FUNCTIONS_EMULATOR_PORT", "functions"],
  ])("the dev build's %s matches the %s emulator", (constant, service) => {
    const port = Number(
      extract("lib/firebase/emulators.ts", new RegExp(`const ${constant} = (\\d+);`)),
    );

    expect(port).toBe(emulators[service].port);
  });
});

describe("subscription tiers", () => {
  test("every tier has a badge configuration", () => {
    expect(Object.keys(TIER_CONFIG).sort()).toEqual([...SubscriptionTierSchema.options].sort());
  });

  test("badge labels are the upper-case tier names", () => {
    for (const { label, name } of Object.values(TIER_CONFIG)) {
      expect(label).toBe(name.toUpperCase());
    }
  });

  test("every tier accent is a real colour token in both themes", () => {
    for (const { accentToken } of Object.values(TIER_CONFIG)) {
      expect(Colors.light).toHaveProperty(accentToken);
      expect(Colors.dark).toHaveProperty(accentToken);
    }
  });
});

describe("Colors", () => {
  test("light and dark define exactly the same tokens", () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  const COLOUR = /^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|transparent)$/i;

  test("every other token is a colour React Native can parse", () => {
    for (const theme of [Colors.light, Colors.dark]) {
      for (const [token, value] of Object.entries(theme)) {
        if (token === "transparent") continue;
        expect([token, value]).toEqual([token, expect.stringMatching(COLOUR)]);
      }
    }
  });

  // FIXME: "FFFFFF00" is missing its "#", so React Native rejects it as a
  // colour (used by the profile screen and WeightDisplay backgrounds).
  test.failing("the transparent token is a colour React Native can parse", () => {
    expect(Colors.light.transparent).toMatch(COLOUR);
    expect(Colors.dark.transparent).toMatch(COLOUR);
  });
});

describe("queryKeys", () => {
  test("detail keys are nested under their list key, so invalidating the list refreshes them", () => {
    const nested = [
      [queryKeys.exerciseLogs.all, queryKeys.exerciseLogs.byDate("2026-06-10")],
      [queryKeys.exerciseLogs.all, queryKeys.exerciseLogs.byMonth("2026-06")],
      [queryKeys.exerciseLogs.all, queryKeys.exerciseLogs.byId("abc")],
      [queryKeys.latestExercises.all, queryKeys.latestExercises.byName("squat")],
      [queryKeys.labels.all, queryKeys.labels.byId("l1")],
      [queryKeys.labelAssignments.all, queryKeys.labelAssignments.byMonth("2026-06")],
      [queryKeys.labelAssignments.all, queryKeys.labelAssignments.byDate("2026-06-10")],
      [queryKeys.programs.all, queryKeys.programs.byId("p1")],
    ];

    for (const [list, detail] of nested) {
      expect(detail.slice(0, list.length)).toEqual([...list]);
    }
  });

  test("the top-level keys never collide", () => {
    const roots = Object.values(queryKeys).map((group) => group.all[0]);

    expect(new Set(roots).size).toBe(roots.length);
  });

  test("today's weight status is NOT under weightLogs, so it must be invalidated on its own", () => {
    // Pinned: WeightEntryModal and WeightListModal invalidate both keys. A new
    // caller that only invalidates weightLogs.all would leave it stale.
    const status = queryKeys.weightLogs.todayStatus("2026-06-10");

    expect(status).toEqual(["2026-06-10"]);
    expect(status[0]).not.toBe(queryKeys.weightLogs.all[0]);
  });
});
