import { readRejectionReason } from "../coachErrors";

const refusal = (code: unknown, details?: unknown) => Object.assign(new Error("refused"), { code, details });

describe("readRejectionReason", () => {
  test.each([
    ["React Native Firebase on device", "resource-exhausted"],
    ["the Firebase JS SDK", "functions/resource-exhausted"],
  ])("reads a quota refusal as sent by %s", (_sdk, code) => {
    expect(readRejectionReason(refusal(code, { reason: "quota" }))).toBe("quota");
  });

  test.each(["resource-exhausted", "functions/resource-exhausted"])(
    "reads a rate-limit refusal with code %p",
    (code) => {
      expect(readRejectionReason(refusal(code, { reason: "rate_limit" }))).toBe("rate_limit");
    },
  );

  test("treats a refusal without a reason as quota, the safe reading", () => {
    expect(readRejectionReason(refusal("resource-exhausted"))).toBe("quota");
    expect(readRejectionReason(refusal("resource-exhausted", null))).toBe("quota");
  });

  test("treats an unknown reason as quota", () => {
    expect(readRejectionReason(refusal("resource-exhausted", { reason: "something-new" }))).toBe("quota");
  });

  test.each([
    ["an unauthenticated error", refusal("unauthenticated")],
    ["an invalid-argument error", refusal("invalid-argument")],
    ["another module's resource-exhausted", refusal("firestore/resource-exhausted")],
    ["a code that only contains the word", refusal("not-resource-exhausted")],
    ["a plain Error", new Error("Network request failed")],
    ["a non-string code", refusal(8)],
    ["null", null],
    ["undefined", undefined],
    ["a string", "resource-exhausted"],
  ])("is null for %s", (_name, error) => {
    expect(readRejectionReason(error)).toBeNull();
  });
});
