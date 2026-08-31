import { describe, expect, it } from "vitest";
import { FREE_TOKEN_CAP, MIN_HEADROOM_TOKENS } from "../../src/quota/caps.js";
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

  it("reports 100 for a cap that is entirely headroom", () => {
    // A cap equal to the headroom is spendable === 0: the gate refuses the very
    // first turn, so the bar must start full rather than empty. This is the
    // case the zero-cap guard used to catch only by accident.
    expect(toPercentUsed(0, MIN_HEADROOM_TOKENS)).toBe(100);
  });

  it("reports 0 for a fresh user with a real cap", () => {
    expect(toPercentUsed(0, 40_000)).toBe(0);
  });

  it("measures against the spendable budget, not the raw cap", () => {
    // 40_000 cap - 5_000 headroom = 35_000 spendable, so half of that is 50%.
    // Against the raw cap this would read 44%, which is the bug: the bar would
    // then top out at 88% and never reach 100 however much the user spent.
    expect(toPercentUsed(17_500, 40_000)).toBe(50);
  });

  it("reports 100 at the exact point the quota gate starts refusing", () => {
    // This is the property the whole change exists for. checkQuota allows a
    // turn while `cap - tokensUsed >= MIN_HEADROOM_TOKENS`, so this is the last
    // spendable token — the bar and the gate now agree on where the wall is.
    expect(
      toPercentUsed(FREE_TOKEN_CAP - MIN_HEADROOM_TOKENS, FREE_TOKEN_CAP),
    ).toBe(100);
  });

  it("rounds to the nearest whole percent", () => {
    // 10_000/35_000 is 28.57 — the app is handed an integer, not a fraction.
    expect(toPercentUsed(10_000, 40_000)).toBe(29);
  });

  it("clamps to 100 when a turn overshoots the budget", () => {
    // Overshoot is by design: the cost of a turn is only known once it has run,
    // so the last allowed turn can push tokensUsed past the budget. A usage bar
    // showing 157% would just look broken.
    expect(toPercentUsed(55_000, 40_000)).toBe(100);
  });
});
