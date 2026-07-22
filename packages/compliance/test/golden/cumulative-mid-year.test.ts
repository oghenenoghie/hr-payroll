import { describe, expect, it } from "vitest";
import { calculateCumulativePayePeriod, calculatePaye } from "../../src/engine/paye.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

const bands = NG_2026_1.paye.bands;

describe("Mid-year pay change → correct cumulative year-to-date position", () => {
  it("a raise that pushes YTD income into a higher band is taxed correctly this period, not as a flat slice", () => {
    // Months 1-6 at ₦500,000/month chargeable: YTD = ₦3,000,000, exactly the
    // top of the 15% band. PAYE paid so far = ₦330,000.
    const cumulativeBefore = nairaToKobo(3_000_000);
    const paidSoFar = calculatePaye(cumulativeBefore, bands);
    expect(paidSoFar).toBe(nairaToKobo(330_000));

    // Month 7: a raise takes this period's chargeable income to ₦1,000,000.
    // YTD becomes ₦4,000,000, which spills ₦1,000,000 into the 18% band.
    const periodPaye = calculateCumulativePayePeriod({
      cumulativeChargeableIncomeBeforePeriod: cumulativeBefore,
      periodChargeableIncome: nairaToKobo(1_000_000),
      cumulativePayeAlreadyPaid: paidSoFar,
      bands,
    });

    // Correct: (₦2,200,000×15% + ₦1,000,000×18%) − ₦330,000 already paid = ₦180,000.
    expect(periodPaye).toBe(nairaToKobo(180_000));

    // Wrong (and what this test guards against): naively taxing just this
    // period's ₦1,000,000 in isolation at 15% would give ₦150,000 — too low,
    // because it ignores that YTD income has already crossed into the 18% band.
    const naiveFlatSlice = nairaToKobo(1_000_000) * 15n / 100n;
    expect(periodPaye).not.toBe(naiveFlatSlice);
  });

  it("cumulative PAYE always equals tax(new YTD) − tax(previous YTD)", () => {
    const cumulativeBefore = nairaToKobo(11_500_000);
    const paidSoFar = calculatePaye(cumulativeBefore, bands);
    const periodChargeable = nairaToKobo(2_000_000);

    const periodPaye = calculateCumulativePayePeriod({
      cumulativeChargeableIncomeBeforePeriod: cumulativeBefore,
      periodChargeableIncome: periodChargeable,
      cumulativePayeAlreadyPaid: paidSoFar,
      bands,
    });

    const expected = calculatePaye(cumulativeBefore + periodChargeable, bands) - paidSoFar;
    expect(periodPaye).toBe(expected);
  });
});
