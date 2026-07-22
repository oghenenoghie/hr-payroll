import { describe, expect, it } from "vitest";
import { calculateChargeableIncome, calculatePaye } from "../../src/engine/paye.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

describe("Chargeable income below ₦800,000 → PAYE = 0, never negative", () => {
  it("PAYE is zero anywhere in the tax-free band", () => {
    expect(calculatePaye(nairaToKobo(0), NG_2026_1.paye.bands)).toBe(0n);
    expect(calculatePaye(nairaToKobo(1), NG_2026_1.paye.bands)).toBe(0n);
    expect(calculatePaye(nairaToKobo(799_999), NG_2026_1.paye.bands)).toBe(0n);
  });

  it("negative chargeable income never occurs — deductions exceeding gross clamp to zero", () => {
    const chargeable = calculateChargeableIncome({
      gross: nairaToKobo(100_000),
      pensionEmployee: nairaToKobo(50_000),
      nhf: nairaToKobo(50_000),
      rentRelief: nairaToKobo(50_000), // would drive the raw result negative
    });
    expect(chargeable).toBe(0n);
    expect(chargeable).toBeGreaterThanOrEqual(0n);
  });

  it("PAYE on a clamped-zero chargeable income is zero, not negative", () => {
    const chargeable = calculateChargeableIncome({
      gross: nairaToKobo(100_000),
      pensionEmployee: nairaToKobo(200_000),
      nhf: 0n,
      rentRelief: 0n,
    });
    expect(calculatePaye(chargeable, NG_2026_1.paye.bands)).toBe(0n);
  });
});
