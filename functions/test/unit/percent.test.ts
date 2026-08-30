import { describe, expect, it } from "vitest";
import { toPercentUsed } from "../../src/quota/check.js";

/**
 * The usage figure the app is allowed to see.
 *
 * This used to be covered only as a side effect of FREE_TOKEN_CAP being 0: an
 * integration test asked a fresh free user for their percentage and asserted
 * 100, which only held because 0/0 hit the guard below. The moment the free
 * tier got a real allowance that test started describing something else, and
 * the guard itself would have gone untested. Hence a direct test.
 */
describe("toPercentUsed", () => {
  it("reports 100 rather than NaN when the cap is zero", () => {
    // 0/0 is NaN, NaN is not valid JSON, and it reaches the app as null — which
    // the usage bar renders as an EMPTY bar. That is the exact opposite of the
    // truth: no allowance at all is fully spent, not untouched.
    expect(toPercentUsed(0, 0)).toBe(100);
  });

  it("reports 100 for a negative cap too", () => {
    // Same guard, defending against a misconfigured constant rather than a
    // deliberate zero. Anything non-positive means "no allowance".
    expect(toPercentUsed(0, -1)).toBe(100);
  });

  it("reports 0 for a fresh user with a real cap", () => {
    expect(toPercentUsed(0, 40_000)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    // 10_000/40_000 is exactly 25%.
    expect(toPercentUsed(10_000, 40_000)).toBe(25);
    // 1/3 rounds to 33, not 33.33 — the app is handed an integer.
    expect(toPercentUsed(10_000, 30_000)).toBe(33);
  });

  it("clamps to 100 when a turn overshoots the cap", () => {
    // Overshoot is by design: the cost of a turn is only known once it has run,
    // so the last allowed turn can push tokensUsed past the cap. A usage bar
    // showing 137% would just look broken.
    expect(toPercentUsed(55_000, 40_000)).toBe(100);
  });
});
