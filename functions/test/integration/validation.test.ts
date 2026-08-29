import { beforeAll, describe, expect, it } from "vitest";
import { MAX_MESSAGE_CHARS } from "../../src/types.js";
import {
  callCoach,
  catchCallableError,
  createTestUser,
  validCoachRequest,
} from "./setup.js";

/**
 * Payload validation, from a signed-in caller.
 *
 * Every case here is rejected before checkQuota runs, so none of them touches
 * the rate-limit bucket — which is why this suite can fire many calls in a row
 * without tripping the limiter it is not testing.
 */
describe("request validation", () => {
  beforeAll(async () => {
    await createTestUser();
  });

  it("rejects a request with no today", async () => {
    const { today: _omitted, ...withoutToday } = validCoachRequest();

    const failure = await catchCallableError(() => callCoach(withoutToday));

    expect(failure.code).toBe("functions/invalid-argument");
  });

  it("rejects an empty message", async () => {
    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest({ message: "" })),
    );

    expect(failure.code).toBe("functions/invalid-argument");
  });

  it("rejects a message longer than MAX_MESSAGE_CHARS", async () => {
    // The cap exists so a caller cannot bill us for an enormous prompt, so the
    // test has to prove the server enforces it — not the app.
    const tooLong = "x".repeat(MAX_MESSAGE_CHARS + 1);

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest({ message: tooLong })),
    );

    expect(failure.code).toBe("functions/invalid-argument");
  });

  it("rejects a today that is years away from the server's date", async () => {
    // Well-formed YYYY-MM-DD, so it passes the schema and is caught by
    // isPlausibleToday instead. Both guards matter; this one covers the second.
    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest({ today: "2020-01-01" })),
    );

    expect(failure.code).toBe("functions/invalid-argument");
  });

  it("rejects a today that is not a date at all", async () => {
    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest({ today: "tomorrow" })),
    );

    expect(failure.code).toBe("functions/invalid-argument");
  });

  it("rejects a request with no prefs", async () => {
    const { prefs: _omitted, ...withoutPrefs } = validCoachRequest();

    const failure = await catchCallableError(() => callCoach(withoutPrefs));

    expect(failure.code).toBe("functions/invalid-argument");
  });
});
