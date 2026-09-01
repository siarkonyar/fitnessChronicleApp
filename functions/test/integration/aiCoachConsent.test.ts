import { describe, expect, it } from "vitest";
import {
  callCoach,
  catchCallableError,
  createTestUser,
  setAiCoachConsent,
  validCoachRequest,
} from "./setup.js";

/**
 * The consent gate: chatWithCoach must refuse before Gemini, quota, or even
 * request validation runs for a user who has not granted
 * users/{uid}.aiCoachConsent. See src/consent/checkAiCoachConsent.ts for why
 * this exists server-side at all rather than trusting the client's gate.
 */
describe("AI coach consent", () => {
  it("refuses a user who explicitly declined", async () => {
    // createTestUser grants consent by default for every other suite; this
    // one exists specifically to test what happens without it, so it
    // overrides that back to false.
    const { uid } = await createTestUser();
    await setAiCoachConsent(uid, false);

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest()),
    );

    expect(failure.code).toBe("functions/failed-precondition");
  });

  it("lets a consenting user reach the next gate", async () => {
    // createTestUser already grants consent. Sending a malformed request
    // proves the consent check does not swallow or mask a later failure —
    // this should fail on validation, not on consent.
    await createTestUser();

    const failure = await catchCallableError(() =>
      callCoach(validCoachRequest({ message: "" })),
    );

    expect(failure.code).toBe("functions/invalid-argument");
  });
});
