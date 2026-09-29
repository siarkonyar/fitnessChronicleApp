import type { AiUsage } from "../ai/coachServer";
import { toPlanCardState, toPlanSummary } from "../planSummary";

// planSummary parses through coachServer, which imports the native Firebase
// modules at load time (Firestore through types/types.ts).
jest.mock("@react-native-firebase/app", () => ({ getApp: jest.fn() }));
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));
jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: { Timestamp: class {} },
}));

// Tests run with TZ=UTC (see package.json), so local time is UTC here.
const NOW = new Date("2026-09-29T12:00:00.000Z");

const usage = (overrides: Partial<AiUsage> = {}): AiUsage => ({
  percentUsed: 42,
  resetsAt: "2026-10-14T09:00:00.000Z",
  tier: "free",
  activeUntil: null,
  billingPeriod: null,
  ...overrides,
});

describe("toPlanSummary", () => {
  test("describes a free user with no expiry", () => {
    expect(toPlanSummary(usage(), NOW)).toEqual({
      tier: "free",
      title: "Free plan",
      percentUsed: 42,
      resetsOn: "14 Oct",
      activeUntil: null,
    });
  });

  test("names a paid plan with its period and shows the year of a later expiry", () => {
    const summary = toPlanSummary(
      usage({
        tier: "pro",
        billingPeriod: "yearly",
        activeUntil: "2027-11-03T09:00:00.000Z",
      }),
      NOW,
    );

    expect(summary).toMatchObject({
      title: "Pro yearly",
      activeUntil: "3 Nov 2027",
    });
  });

  test("names a max monthly plan", () => {
    expect(
      toPlanSummary(usage({ tier: "max", billingPeriod: "monthly" }), NOW).title,
    ).toBe("Max monthly");
  });

  test("names a paid plan without a period when the product id was unknown", () => {
    expect(toPlanSummary(usage({ tier: "pro" }), NOW).title).toBe("Pro");
  });

  test("hides the reset row when the server has no reset date", () => {
    expect(toPlanSummary(usage({ resetsAt: null }), NOW).resetsOn).toBeNull();
  });

  test("hides the expiry row for a paid user the server sent no expiry for", () => {
    // Inside the 24h grace the server sends null rather than a past date.
    expect(
      toPlanSummary(usage({ tier: "pro", activeUntil: null }), NOW).activeUntil,
    ).toBeNull();
  });

  test("ignores an expiry sent alongside the free tier", () => {
    expect(
      toPlanSummary(usage({ activeUntil: "2027-11-03T09:00:00.000Z" }), NOW)
        .activeUntil,
    ).toBeNull();
  });

  test("shows the year when a reset falls in the next year", () => {
    const december = new Date("2026-12-20T12:00:00.000Z");

    expect(
      toPlanSummary(usage({ resetsAt: "2027-01-05T09:00:00.000Z" }), december)
        .resetsOn,
    ).toBe("5 Jan 2027");
  });
});

describe("toPlanCardState", () => {
  test("shows content for a valid response", () => {
    expect(toPlanCardState(usage(), false, NOW)).toMatchObject({
      kind: "content",
      summary: { title: "Free plan" },
    });
  });

  test("shows the skeleton while the first load is in flight", () => {
    expect(toPlanCardState(undefined, true, NOW)).toEqual({ kind: "loading" });
  });

  test("shows the skeleton, not an error, while an old cached number is replaced", () => {
    // Builds from before this endpoint returned an object persisted a bare
    // percentage; staleTime 0 refetches it on open.
    expect(toPlanCardState(37, true, NOW)).toEqual({ kind: "loading" });
  });

  test("shows the error card when nothing usable arrived and nothing is loading", () => {
    expect(toPlanCardState(undefined, false, NOW)).toEqual({ kind: "error" });
  });

  test("keeps showing cached content while a refetch is in flight", () => {
    expect(toPlanCardState(usage(), true, NOW).kind).toBe("content");
  });
});
