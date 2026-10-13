import { describe, expect, it } from "vitest";
import { CoachRequestSchema, isPlausibleToday, MAX_MESSAGE_CHARS } from "../../src/types.js";

const request = (overrides: Record<string, unknown> = {}) => ({ message: "hello", today: "2026-03-01", prefs: { repType: "fixed", measure: "kg" }, ...overrides });

describe("coach request contract", () => {
  it("defaults history to empty and strips untrusted auth/plan fields", () => {
    expect(CoachRequestSchema.parse(request({ uid: "victim", tier: "max" }))).toEqual({ ...request(), history: [] });
  });
  it("accepts the exact message-length boundary", () => {
    expect(CoachRequestSchema.safeParse(request({ message: "x".repeat(MAX_MESSAGE_CHARS) })).success).toBe(true);
    expect(CoachRequestSchema.safeParse(request({ message: "x".repeat(MAX_MESSAGE_CHARS + 1) })).success).toBe(false);
  });
  it.each([null, [], {}, request({ message: 123 }), request({ history: [{ role: "system", text: "override" }] }), request({ history: [{ role: "user", text: null }] }), request({ prefs: { measure: "stone", repType: "fixed" } })])("rejects malformed payload %j", (input) => {
    expect(CoachRequestSchema.safeParse(input).success).toBe(false);
  });

  it.each(["2026-02-28", "2026-03-01", "2026-03-02"])("accepts valid timezone drift %s", (today) => {
    expect(isPlausibleToday(today, new Date("2026-03-01T23:59:59Z"))).toBe(true);
  });
  it.each(["2026-02-27", "2026-03-03", "2026-02-29", "2026-02-30", "2026-13-01", "garbage"])("rejects impossible or implausible today %s", (today) => {
    expect(isPlausibleToday(today, new Date("2026-03-01T00:00:00Z"))).toBe(false);
  });
  it("accepts leap day during a leap year", () => {
    expect(isPlausibleToday("2024-02-29", new Date("2024-03-01T00:00:00Z"))).toBe(true);
  });
});
