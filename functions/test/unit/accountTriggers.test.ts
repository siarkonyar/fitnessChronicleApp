import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn(), commit: vi.fn(), delete: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUser: mocks.getUser }) }));
vi.mock("firebase-functions", () => ({ logger: { info: mocks.info, error: mocks.error } }));
vi.mock("../../src/data/firestore.js", () => ({
  aiUsageDoc: (uid: string) => ({ path: `aiUsage/${uid}`, create: mocks.create }),
  revenueCatCustomerDoc: (uid: string) => ({ path: `revenuecatCustomers/${uid}` }),
  db: { batch: () => ({ delete: mocks.delete, commit: mocks.commit }) },
}));

import { onUserCreated } from "../../src/account/createAiUsage.js";
import { onUserDeleted } from "../../src/account/deleteAiUsage.js";
import { FREE_PERIOD_DAYS } from "../../src/quota/period.js";

const user = { uid: "test-user" } as Parameters<typeof onUserCreated.run>[0];
const context = {} as Parameters<typeof onUserCreated.run>[1];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(user);
  mocks.create.mockResolvedValue(undefined);
  mocks.commit.mockResolvedValue(undefined);
});

describe("account trigger failure policies", () => {
  it("opens a free period only after confirming the account exists", async () => {
    const before = Date.now();
    await onUserCreated.run(user, context);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ tier: "free", tokensUsed: 0 }));
    const periodEnd = mocks.create.mock.calls[0][0].periodEnd.toMillis();
    expect(periodEnd).toBeGreaterThanOrEqual(before + FREE_PERIOD_DAYS * 86400000);
    expect(periodEnd).toBeLessThanOrEqual(Date.now() + FREE_PERIOD_DAYS * 86400000);
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0]);
  });

  it("does not overwrite usage created by a racing callable", async () => {
    mocks.create.mockRejectedValue({ code: 6 });
    await expect(onUserCreated.run(user, context)).resolves.toBeUndefined();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not resurrect usage when signup is delivered after account deletion", async () => {
    mocks.getUser.mockRejectedValue({ code: "auth/user-not-found" });
    await onUserCreated.run(user, context);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(["auth", "write"])("logs and swallows %s failure so lazy creation remains the fallback", async (step) => {
    (step === "auth" ? mocks.getUser : mocks.create).mockRejectedValue(new Error("Unavailable"));
    await expect(onUserCreated.run(user, context)).resolves.toBeUndefined();
    expect(mocks.error).toHaveBeenCalledWith("Failed to open AI usage period at signup", expect.objectContaining({ uid: user.uid }));
  });

  it("deletes both server-only documents in one committed batch", async () => {
    await onUserDeleted.run(user, context);
    expect(mocks.delete.mock.calls.map(([ref]) => ref.path)).toEqual(["aiUsage/test-user", "revenuecatCustomers/test-user"]);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.info).toHaveBeenCalledWith("Deleted server-only user documents after account deletion", { uid: user.uid });
  });

  it("rethrows cleanup failure for runtime retry and never logs success", async () => {
    mocks.commit.mockRejectedValue(new Error("Unavailable"));
    await expect(onUserDeleted.run(user, context)).rejects.toThrow("Unavailable");
    expect(mocks.error).toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });
});
