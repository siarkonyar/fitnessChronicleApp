import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { aiUsageQueryOptions } from "../aiUsageQuery";
import {
  AiUsageSchema,
  CoachResponseSchema,
  callAiUsage,
  callCoach,
  type CoachRequest,
} from "../coachServer";

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

describe("CoachResponseSchema", () => {
  test("requires a reply string on top of the usage figures", () => {
    expect(CoachResponseSchema.safeParse(PAID).success).toBe(false);
    expect(CoachResponseSchema.safeParse({ ...PAID, reply: "" }).success).toBe(true);
  });

  test("passes a valid proposed program through", () => {
    const program = { name: "PPL", days: [{ isRestDay: true }] };

    expect(CoachResponseSchema.parse({ ...PAID, reply: "x", program }).program).toEqual(program);
  });

  test("rejects the whole reply when the proposed program is malformed", () => {
    // The reply was already billed; this is where a bad draft from the model
    // would surface as a generic error in the chat.
    const program = { name: "", days: [] };

    expect(CoachResponseSchema.safeParse({ ...PAID, reply: "x", program }).success).toBe(false);
  });

  test("rejects a resetsAt that is not an ISO timestamp", () => {
    expect(AiUsageSchema.safeParse({ ...PAID, resetsAt: "next month" }).success).toBe(false);
  });

  test("accepts a percentage over 100, which the server sends once a turn overshoots", () => {
    expect(AiUsageSchema.parse({ ...PAID, percentUsed: 104 }).percentUsed).toBe(104);
  });
});

describe("callable wrappers", () => {
  const request: CoachRequest = {
    message: "Plan my week",
    history: [{ role: "user", text: "hi" }, { role: "model", text: "hello" }],
    today: "2026-06-10",
    prefs: { repType: "range", measure: "lbs" },
  };

  const respondWith = (data: unknown) => {
    const callable = jest.fn().mockResolvedValue({ data });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    return callable;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getFunctions as jest.Mock).mockReturnValue("functions-instance");
  });

  test("callCoach calls chatWithCoach in europe-west2 with the request untouched", async () => {
    const callable = respondWith({ ...PAID, reply: "Here you go" });

    const response = await callCoach(request);

    expect(getFunctions).toHaveBeenCalledWith(undefined, "europe-west2");
    expect(httpsCallable).toHaveBeenCalledWith("functions-instance", "chatWithCoach");
    expect(callable).toHaveBeenCalledWith(request);
    expect(response.reply).toBe("Here you go");
  });

  test("callCoach rejects a response it cannot read", async () => {
    respondWith({ reply: 42 });

    await expect(callCoach(request)).rejects.toThrow();
  });

  test("callCoach passes a server refusal through untouched", async () => {
    const refusal = Object.assign(new Error("quota"), {
      code: "resource-exhausted",
      details: { reason: "quota" },
    });
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(refusal));

    await expect(callCoach(request)).rejects.toBe(refusal);
  });

  test("callAiUsage calls the legacy getUsagePercentage name with no payload", async () => {
    const callable = respondWith(PAID);

    expect(await callAiUsage()).toEqual(PAID);
    expect(httpsCallable).toHaveBeenCalledWith("functions-instance", "getUsagePercentage");
    expect(callable).toHaveBeenCalledWith();
  });

  test("callAiUsage rejects the bare number an old server returned", async () => {
    respondWith(42);

    await expect(callAiUsage()).rejects.toThrow();
  });

  test("the shared usage query never serves a cached figure as fresh", () => {
    const options = aiUsageQueryOptions();

    expect(options.queryKey).toEqual(["aiUsage"]);
    expect(options.staleTime).toBe(0);
    expect(options.queryFn).toBe(callAiUsage);
  });
});
