import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallableRequest } from "firebase-functions/https";

vi.mock("../../src/ai/flows/coach.js", () => ({ coachFlow: vi.fn() }));
vi.mock("../../src/ai/genkit.js", () => ({ COACH_MODEL: "test-model", COACH_THINKING_LEVEL: "minimal" }));
vi.mock("../../src/quota/check.js", async (importOriginal) => ({ ...await importOriginal<object>(), checkQuota: vi.fn() }));
vi.mock("../../src/quota/record.js", () => ({ recordUsage: vi.fn() }));
vi.mock("../../src/telemetry/aiTurn.js", () => ({ recordTurn: vi.fn() }));
vi.mock("../../src/data/firestore.js", () => ({}));
vi.mock("../../src/account/createAiUsage.js", () => ({ onUserCreated: {} }));
vi.mock("../../src/account/deleteAiUsage.js", () => ({ onUserDeleted: {} }));
vi.mock("../../src/consent/recordConsentChange.js", () => ({ onConsentChanged: {} }));
vi.mock("../../src/revenuecat/syncCustomer.js", () => ({ onRevenueCatCustomerWritten: {} }));

import { chatWithCoach, getUsagePercentage, ping } from "../../src/index.js";
import { coachFlow } from "../../src/ai/flows/coach.js";
import { checkQuota, toPercentUsed, type QuotaDecision } from "../../src/quota/check.js";
import { recordUsage } from "../../src/quota/record.js";
import { recordTurn } from "../../src/telemetry/aiTurn.js";

const input = () => ({ message: "Private message", history: [], today: new Date().toISOString().slice(0, 10), prefs: { repType: "fixed", measure: "kg" } });
const request = (data: unknown = input(), uid: string | undefined = "verified-user") => ({ data, ...(uid && { auth: { uid, token: {} } }) }) as CallableRequest;
const quota = (): QuotaDecision => ({ allowed: true, tokensUsed: 100, cap: 40000, percentUsed: 0, tier: "free", resetsAt: new Date("2026-12-01T00:00:00Z"), activeUntil: null, productId: null });
const result = () => ({ reply: "A useful reply", totalTokens: 900, inputTokens: 100, outputTokens: 200, thoughtsTokens: 600, toolCalls: ["getLabels"], latencyMs: 12, usedFallbackReply: false });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkQuota).mockResolvedValue(quota());
  vi.mocked(coachFlow).mockResolvedValue(result());
  vi.mocked(recordUsage).mockResolvedValue();
});

describe("callable orchestration with a deterministic coach", () => {
  it.each([chatWithCoach, getUsagePercentage, ping])("authenticates before other work", async (callable) => {
    await expect(Promise.resolve().then(async (): Promise<unknown> => callable.run(request(null, "")))).rejects.toMatchObject({ code: "unauthenticated" });
    expect(checkQuota).not.toHaveBeenCalled();
    expect(coachFlow).not.toHaveBeenCalled();
  });

  it.each([null, {}, input().message, { ...input(), message: "" }, { ...input(), today: "2026-02-30" }])("validates %j before consuming rate tokens", async (data) => {
    await expect(chatWithCoach.run(request(data))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(checkQuota).not.toHaveBeenCalled();
    expect(coachFlow).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it.each(["quota", "rate_limit"] as const)("never calls the model or charges a %s refusal", async (reason) => {
    vi.mocked(checkQuota).mockResolvedValue({ ...quota(), allowed: false, reason });
    await expect(chatWithCoach.run(request())).rejects.toMatchObject({ code: "resource-exhausted", details: { reason } });
    expect(coachFlow).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
    expect(recordTurn).toHaveBeenCalledWith(expect.objectContaining({ outcome: reason, uid: "verified-user" }));
  });

  it("passes verified identity in context and charges the successful total before returning", async () => {
    const data = { ...input(), uid: "victim", tier: "max" };
    const response = await chatWithCoach.run(request(data));
    expect(checkQuota).toHaveBeenCalledWith("verified-user");
    expect(coachFlow).toHaveBeenCalledWith(input(), { context: { auth: { uid: "verified-user" }, prefs: input().prefs } });
    expect(recordUsage).toHaveBeenCalledWith("verified-user", 900);
    expect(response).toEqual({ reply: "A useful reply", percentUsed: toPercentUsed(1000, 40000), tier: "free", resetsAt: "2026-12-01T00:00:00.000Z", activeUntil: null, billingPeriod: null });
    expect(vi.mocked(checkQuota).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(coachFlow).mock.invocationCallOrder[0]);
    expect(vi.mocked(recordUsage).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(recordTurn).mock.invocationCallOrder[0]);
    const serializedTelemetry = JSON.stringify(vi.mocked(recordTurn).mock.calls);
    expect(serializedTelemetry).not.toContain("Private message");
    expect(serializedTelemetry).not.toContain("A useful reply");
  });

  it("returns a proposed program and paid usage fields through the same contract as the usage endpoint", async () => {
    const paid = { ...quota(), tier: "max" as const, activeUntil: new Date("2027-01-01T00:00:00Z"), productId: "hercule_max_yearly" };
    const program = { name: "Plan", days: [{ isRestDay: true }] };
    vi.mocked(checkQuota).mockResolvedValue(paid);
    vi.mocked(coachFlow).mockResolvedValue({ ...result(), program });
    const chat = await chatWithCoach.run(request());
    const usage = await getUsagePercentage.run(request());
    expect(chat).toMatchObject({ ...usage, percentUsed: toPercentUsed(1000, paid.cap), program });
    expect(usage).toMatchObject({ tier: "max", activeUntil: "2027-01-01T00:00:00.000Z", billingPeriod: "yearly" });
    expect(checkQuota).toHaveBeenLastCalledWith("verified-user", expect.any(Date), { spendRateToken: false });
  });

  it("does not bill provider failures and records an error without message text", async () => {
    vi.mocked(coachFlow).mockRejectedValue(new Error("Provider unavailable"));
    await expect(chatWithCoach.run(request())).rejects.toThrow("Provider unavailable");
    expect(recordUsage).not.toHaveBeenCalled();
    expect(recordTurn).toHaveBeenCalledWith({ uid: "verified-user", tier: "free", messageChars: 15, historyLength: 0, outcome: "error" });
  });

  it("propagates metering failure and does not report success", async () => {
    vi.mocked(recordUsage).mockRejectedValue(new Error("Meter unavailable"));
    await expect(chatWithCoach.run(request())).rejects.toThrow("Meter unavailable");
    expect(recordTurn).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: "ok" }));
  });

  it("does not generate or meter on a quota-storage failure", async () => {
    vi.mocked(checkQuota).mockRejectedValue(new Error("Firestore unavailable"));
    await expect(chatWithCoach.run(request())).rejects.toThrow("Firestore unavailable");
    expect(coachFlow).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
