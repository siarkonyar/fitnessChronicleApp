import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ add: vi.fn(), error: vi.fn() }));
vi.mock("../../src/data/firestore.js", () => ({ consentEventsCollection: () => ({ add: mocks.add }) }));
vi.mock("firebase-functions", () => ({ logger: { error: mocks.error } }));
import { onConsentChanged } from "../../src/consent/recordConsentChange.js";

const event = (before: unknown, after: unknown) => ({
  params: { uid: "owner" }, data: { before: { data: () => before }, after: { data: () => after } },
}) as Parameters<typeof onConsentChanged.run>[0];

beforeEach(() => { vi.resetAllMocks(); mocks.add.mockResolvedValue({}); });

describe("consent audit trigger", () => {
  it.each([true, false])("records first explicit choice %s with previous=null and a server timestamp", async (granted) => {
    await onConsentChanged.run(event(undefined, { analyticsConsent: granted, name: "Private name" }));
    expect(mocks.add).toHaveBeenCalledWith({ uid: "owner", setting: "analytics", granted, previous: null, at: expect.anything() });
    expect(JSON.stringify(mocks.add.mock.calls)).not.toContain("Private name");
  });

  it("records an explicit withdrawal as a transition from true to false", async () => {
    await onConsentChanged.run(event({ analyticsConsent: true }, { analyticsConsent: false }));
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ granted: false, previous: true }));
  });

  it.each([
    [undefined, { measure: "kg" }],
    [{ analyticsConsent: true }, { analyticsConsent: true, measure: "lbs" }],
    [{ analyticsConsent: false }, { analyticsConsent: false }],
    [{ analyticsConsent: true }, undefined],
    [{ analyticsConsent: true }, {}],
    [undefined, { analyticsConsent: "true" }],
  ])("does not invent a consent event for %j -> %j", async (before, after) => {
    await onConsentChanged.run(event(before, after));
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("logs an append failure without rethrowing and inviting a duplicate retry", async () => {
    mocks.add.mockRejectedValue(new Error("Unavailable"));
    await expect(onConsentChanged.run(event({}, { analyticsConsent: true }))).resolves.toBeUndefined();
    expect(mocks.error).toHaveBeenCalledWith("Failed to record consent change", expect.objectContaining({ uid: "owner", setting: "analytics", granted: true }));
  });
});
