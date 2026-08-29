import { beforeAll, describe, expect, it } from "vitest";
import {
  callCoach,
  callPing,
  callUsagePercentage,
  catchCallableError,
  signOutTestUser,
  validCoachRequest,
} from "./setup.js";

/**
 * The headline guard: an anonymous caller gets nothing.
 *
 * Worth testing over the wire rather than by calling the handler with a fake
 * request. The uid check in src/index.ts is only half the story — the other
 * half is the Functions SDK refusing to populate request.auth for a caller
 * with no valid ID token, and only a real request exercises that.
 */
describe("unauthenticated callers", () => {
  beforeAll(async () => {
    // Other suites sign users in and the client SDK holds that session. Left
    // signed in, these tests would silently pass for the wrong reason.
    await signOutTestUser();
  });

  it("rejects chatWithCoach", async () => {
    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/unauthenticated");
  });

  it("rejects ping", async () => {
    const failure = await catchCallableError(() => callPing({ hello: "there" }));

    expect(failure.code).toBe("functions/unauthenticated");
  });

  it("rejects getUsagePercentage", async () => {
    const failure = await catchCallableError(() => callUsagePercentage());

    expect(failure.code).toBe("functions/unauthenticated");
  });
});
