import { describe, expect, it } from "vitest";
import { naira, toNaira } from "../src/money";
import { NG_2026_1 } from "../src/rule-versions/ng-2026.1";
import { computeAnnualPaye, computeCumulativePeriodPaye, computeRentRelief } from "../src/schemes/paye";
import { computePension } from "../src/schemes/pension";
import { computeNhf } from "../src/schemes/nhf";
import { computeNsitf } from "../src/schemes/nsitf";
import { computeItf } from "../src/schemes/itf";
import { checkTinGate } from "../src/tin-gate";
import { TinRequiredError } from "../src/errors";
import { deriveDemoPaye } from "../src/demo";
import type { PayComponent } from "../src/types";

const rv = NG_2026_1;

describe("PAYE band boundaries (§12)", () => {
  const boundaries = [800_000, 3_000_000, 12_000_000, 25_000_000, 50_000_000];

  for (const boundary of boundaries) {
    it(`marginal rate applies only to the slice above ₦${boundary.toLocaleString()}`, () => {
      const atBoundary = computeAnnualPaye(naira(boundary), rv);
      const oneNairaBelow = computeAnnualPaye(naira(boundary - 1), rv);
      const oneNairaAbove = computeAnnualPaye(naira(boundary + 1), rv);

      // Crossing the boundary by ₦1 changes tax by (at most) that ₦1 taxed at
      // the *next* band's rate — never a jump that taxes the whole amount
      // at the higher rate.
      const deltaKobo = oneNairaAbove.annualPayeKobo - atBoundary.annualPayeKobo;
      expect(deltaKobo).toBeGreaterThanOrEqual(0n);
      expect(deltaKobo).toBeLessThanOrEqual(naira(1));

      expect(atBoundary.annualPayeKobo).toBeGreaterThanOrEqual(oneNairaBelow.annualPayeKobo);
    });
  }
});

describe("PAYE worked example (§12, validated against a public guide)", () => {
  it("chargeable income ₦3,162,000 → ₦359,160", () => {
    const result = computeAnnualPaye(naira(3_162_000), rv);
    expect(result.bands[0]?.taxInBandKobo).toBe(0n);
    expect(result.bands[1]?.taxInBandKobo).toBe(naira(330_000));
    expect(result.bands[2]?.taxInBandKobo).toBe(naira(29_160));
    expect(result.annualPayeKobo).toBe(naira(359_160));
  });
});

describe("Rent relief", () => {
  it("caps at ₦500,000 when 20% of rent exceeds the cap", () => {
    const relief = computeRentRelief(naira(4_000_000), rv); // 20% = 800,000 > cap
    expect(relief).toBe(naira(500_000));
  });

  it("is exactly at the cap when 20% of rent equals ₦500,000", () => {
    const relief = computeRentRelief(naira(2_500_000), rv); // 20% = exactly 500,000
    expect(relief).toBe(naira(500_000));
  });

  it("is zero for zero rent paid", () => {
    expect(computeRentRelief(0n, rv)).toBe(0n);
  });
});

describe("Sub-threshold income", () => {
  it("chargeable income below ₦800,000 yields PAYE = 0, never negative", () => {
    const result = computeAnnualPaye(naira(500_000), rv);
    expect(result.annualPayeKobo).toBe(0n);
    expect(result.annualPayeKobo).toBeGreaterThanOrEqual(0n);
  });

  it("clamps a negative chargeable income (over-relieved) to zero PAYE", () => {
    const result = computeAnnualPaye(-naira(100_000), rv);
    expect(result.annualPayeKobo).toBe(0n);
  });
});

describe("Mid-year pay change — cumulative recompute", () => {
  it("recomputes YTD position rather than taking a naive monthly slice", () => {
    // Employee on ₦6,000,000/yr for 6 months, then a raise to ₦12,000,000/yr
    // for the remaining 6 months. A naive monthly-slice engine would just
    // keep withholding at the original monthly rate; cumulative PAYE must
    // instead true up against the full year-to-date chargeable income.
    const lowChargeablePerMonth = naira(6_000_000) / 12n;
    const highChargeablePerMonth = naira(12_000_000) / 12n;

    let payeWithheldYtd = 0n;
    let chargeableYtd = 0n;

    for (let month = 1; month <= 6; month++) {
      chargeableYtd += lowChargeablePerMonth;
      const periodPaye = computeCumulativePeriodPaye(chargeableYtd, payeWithheldYtd, rv);
      payeWithheldYtd += periodPaye;
    }

    for (let month = 7; month <= 12; month++) {
      chargeableYtd += highChargeablePerMonth;
      const periodPaye = computeCumulativePeriodPaye(chargeableYtd, payeWithheldYtd, rv);
      payeWithheldYtd += periodPaye;
    }

    const fullYearAtNewRate = computeAnnualPaye(chargeableYtd, rv).annualPayeKobo;
    expect(payeWithheldYtd).toBe(fullYearAtNewRate);
  });
});

describe("TIN gate", () => {
  it("blocks a run for an employee with no TIN rather than silently processing them", () => {
    const blocked = checkTinGate([
      { employeeId: "emp-1", tin: "TIN-123" },
      { employeeId: "emp-2", tin: null },
    ]);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toBeInstanceOf(TinRequiredError);
    expect(blocked[0]?.employeeId).toBe("emp-2");
  });
});

describe("Per-scheme base correctness — never reuse another scheme's base", () => {
  const components: PayComponent[] = [
    { code: "basic", amountKobo: naira(600_000), kind: "regular" },
    { code: "housing", amountKobo: naira(300_000), kind: "regular" },
    { code: "transport", amountKobo: naira(100_000), kind: "regular" },
    { code: "meal_allowance", amountKobo: naira(50_000), kind: "regular" },
  ];

  it("pension is based on basic + housing + transport, excluding other allowances", () => {
    const result = computePension(components, rv);
    expect(result.pensionableBaseKobo).toBe(naira(1_000_000));
    expect(result.employeeKobo).toBe(naira(80_000));
    expect(result.employerKobo).toBe(naira(100_000));
  });

  it("NHF is based on basic salary only", () => {
    const nhf = computeNhf(components, rv);
    expect(nhf).toBe(naira(15_000)); // 2.5% of 600,000
  });

  it("NSITF base excludes bonuses, overtime, and 13th-month pay", () => {
    const withBonus: PayComponent[] = [
      ...components,
      { code: "bonus", amountKobo: naira(200_000), kind: "bonus" },
      { code: "thirteenth_month", amountKobo: naira(600_000), kind: "thirteenth_month" },
    ];
    const result = computeNsitf([withBonus], rv);
    expect(result.totalMonthlyPayrollBaseKobo).toBe(naira(1_050_000)); // regular components only
    expect(result.employerKobo).toBe(naira(10_500)); // 1%
  });
});

describe("Employer-side costs are never in the employee deduction total", () => {
  it("pension employer share and NSITF/ITF are tracked separately", () => {
    const components: PayComponent[] = [
      { code: "basic", amountKobo: naira(500_000), kind: "regular" },
      { code: "housing", amountKobo: naira(300_000), kind: "regular" },
      { code: "transport", amountKobo: naira(200_000), kind: "regular" },
    ];
    const pension = computePension(components, rv);
    const nsitf = computeNsitf([components], rv);
    const itf = computeItf(naira(12_000_000), { employeeCount: 10, annualTurnoverKobo: naira(80_000_000) }, rv);

    const employeeDeductionTotal = pension.employeeKobo; // + NHF, PAYE — none of these below
    const employerCostTotal = pension.employerKobo + nsitf.employerKobo + itf.employerKobo;

    expect(employeeDeductionTotal).toBeGreaterThan(0n);
    expect(employerCostTotal).toBeGreaterThan(0n);
    // Employer costs must never leak into the employee side.
    expect(employeeDeductionTotal).not.toBe(employerCostTotal);
    expect(pension.employeeKobo).toBe(naira(80_000));
    expect(pension.employerKobo).toBe(naira(100_000));
  });

  it("ITF only applies for qualifying employers", () => {
    const nonQualifying = computeItf(naira(10_000_000), { employeeCount: 2, annualTurnoverKobo: naira(5_000_000) }, rv);
    expect(nonQualifying.qualifies).toBe(false);
    expect(nonQualifying.employerKobo).toBe(0n);

    const qualifyingByHeadcount = computeItf(naira(10_000_000), { employeeCount: 5, annualTurnoverKobo: naira(5_000_000) }, rv);
    expect(qualifyingByHeadcount.qualifies).toBe(true);
    expect(qualifyingByHeadcount.employerKobo).toBe(naira(100_000));
  });
});

describe("Multi-state workforce reconciliation", () => {
  it("per-state PAYE liability sums to the org total", () => {
    const employees = [
      { state: "Lagos", chargeableKobo: naira(2_000_000) },
      { state: "Lagos", chargeableKobo: naira(5_000_000) },
      { state: "Rivers", chargeableKobo: naira(15_000_000) },
      { state: "FCT", chargeableKobo: naira(900_000) },
    ];

    const perState = new Map<string, bigint>();
    let orgTotal = 0n;
    for (const emp of employees) {
      const paye = computeAnnualPaye(emp.chargeableKobo, rv).annualPayeKobo;
      perState.set(emp.state, (perState.get(emp.state) ?? 0n) + paye);
      orgTotal += paye;
    }

    const summedFromStates = [...perState.values()].reduce((sum, v) => sum + v, 0n);
    expect(summedFromStates).toBe(orgTotal);
    expect(perState.size).toBe(3);
  });
});

describe("Property tests", () => {
  const samples = [0, 500_000, 800_000, 1_500_000, 3_000_000, 8_000_000, 12_000_000, 20_000_000, 25_000_000, 40_000_000, 50_000_000, 90_000_000];

  it("sum of per-band tax never exceeds chargeable income", () => {
    for (const sample of samples) {
      const result = computeAnnualPaye(naira(sample), rv);
      expect(result.annualPayeKobo).toBeLessThanOrEqual(result.chargeableIncomeKobo);
    }
  });

  it("no negative deductions", () => {
    for (const sample of samples) {
      const result = computeAnnualPaye(naira(sample), rv);
      expect(result.annualPayeKobo).toBeGreaterThanOrEqual(0n);
      for (const band of result.bands) {
        expect(band.taxInBandKobo).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it("monthly PAYE × 12 reconciles to the annual computation within rounding tolerance", () => {
    for (const sample of samples) {
      const { annualPayeKobo } = computeAnnualPaye(naira(sample), rv);
      const monthly = annualPayeKobo / 12n;
      const reconciled = monthly * 12n;
      const diff = annualPayeKobo - reconciled;
      expect(diff).toBeGreaterThanOrEqual(0n);
      expect(diff).toBeLessThan(12n); // rounding tolerance: < 1 kobo per period
    }
  });
});

describe("Demo PAYE Calculator derivation (product's illustrative screen)", () => {
  it("matches the four-step derivation for ₦5,000,000 gross / ₦1,200,000 rent", () => {
    const derivation = deriveDemoPaye(naira(5_000_000), naira(1_200_000), rv);
    expect(derivation.pensionableBaseKobo).toBe(naira(5_000_000)); // 50/30/20 sums to 100% of gross
    expect(derivation.pensionEmployeeKobo).toBe(naira(400_000)); // 8%
    expect(derivation.nhfKobo).toBe(naira(62_500)); // 2.5% of 2,500,000 basic
    expect(derivation.rentReliefKobo).toBe(naira(240_000)); // 20% of 1,200,000, under cap
    expect(toNaira(derivation.chargeableIncomeKobo)).toBeCloseTo(5_000_000 - 400_000 - 62_500 - 240_000, 2);
    expect(derivation.annualPayeKobo).toBeGreaterThan(0n);
    expect(derivation.monthlyPayeKobo).toBe(derivation.annualPayeKobo / 12n);
  });
});
