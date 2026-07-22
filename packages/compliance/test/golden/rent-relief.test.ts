import { describe, expect, it } from "vitest";
import { calculateRentRelief } from "../../src/engine/paye.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

const rentReliefRules = NG_2026_1.paye.rentRelief;

describe("Rent relief — 20% of annual rent, capped at ₦500,000", () => {
  it("exactly at the cap", () => {
    // ₦2,500,000 × 20% = ₦500,000, exactly the cap
    const relief = calculateRentRelief(nairaToKobo(2_500_000), rentReliefRules);
    expect(relief).toBe(nairaToKobo(500_000));
  });

  it("rent high enough to exceed the cap", () => {
    // ₦3,000,000 × 20% = ₦600,000, clamped down to ₦500,000
    const relief = calculateRentRelief(nairaToKobo(3_000_000), rentReliefRules);
    expect(relief).toBe(nairaToKobo(500_000));
  });

  it("zero rent", () => {
    const relief = calculateRentRelief(0n, rentReliefRules);
    expect(relief).toBe(0n);
  });
});
