import { AiUsageSchema } from "../coachServer";

// coachServer imports the native Firebase modules at load time (Firestore
// through types/types.ts); the schema under test never touches them.
jest.mock("@react-native-firebase/app", () => ({ getApp: jest.fn() }));
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));
jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

const PAID = {
  percentUsed: 42,
  resetsAt: "2026-10-14T09:00:00.000Z",
  tier: "pro",
  activeUntil: "2027-11-03T09:00:00.000Z",
  billingPeriod: "yearly",
};

describe("AiUsageSchema", () => {
  test("keeps every field of a paid response", () => {
    expect(AiUsageSchema.parse(PAID)).toEqual(PAID);
  });

  test("reads a response from a server without the plan fields as nulls", () => {
    // The app can ship before the functions deploy that adds them.
    const { activeUntil: _a, billingPeriod: _b, ...oldServer } = PAID;

    expect(AiUsageSchema.parse(oldServer)).toMatchObject({
      activeUntil: null,
      billingPeriod: null,
    });
  });

  test("reads a tier this build does not know as free instead of throwing", () => {
    // T1: throwing here fails a coach reply the user has already paid for.
    expect(AiUsageSchema.parse({ ...PAID, tier: "ultra" }).tier).toBe("free");
  });

  test("reads an unknown billing period as null", () => {
    expect(
      AiUsageSchema.parse({ ...PAID, billingPeriod: "weekly" }).billingPeriod,
    ).toBeNull();
  });

  test("still rejects a response with no percentage", () => {
    const { percentUsed: _p, ...noPercent } = PAID;

    expect(AiUsageSchema.safeParse(noPercent).success).toBe(false);
  });
});
