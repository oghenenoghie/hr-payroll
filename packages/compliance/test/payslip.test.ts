import { describe, expect, it } from "vitest";
import { naira } from "../src/money";
import { NG_2026_1 } from "../src/rule-versions/ng-2026.1";
import { computeAnnualPaye } from "../src/schemes/paye";
import { computeNsitf } from "../src/schemes/nsitf";
import { derivePeriodPayslip, deriveLumpSumPayslip } from "../src/payslip";
import { computePension } from "../src/schemes/pension";
import { computeNhf } from "../src/schemes/nhf";
import type { PayComponent } from "../src/types";

const rv = NG_2026_1;

function annualComponents(basic: number, housing: number, transport: number): PayComponent[] {
  return [
    { code: "basic", amountKobo: naira(basic), kind: "regular" },
    { code: "housing", amountKobo: naira(housing), kind: "regular" },
    { code: "transport", amountKobo: naira(transport), kind: "regular" },
  ];
}

describe("derivePeriodPayslip", () => {
  it("a single employee's first monthly payslip is roughly 1/12th of their annual position", () => {
    const result = derivePeriodPayslip(
      {
        annualPayComponents: annualComponents(3_000_000, 1_500_000, 900_000),
        annualRentPaidKobo: naira(1_200_000),
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    expect(result.grossKobo).toBe(naira((3_000_000 + 1_500_000 + 900_000) / 12));
    expect(result.pensionEmployerKobo).toBeGreaterThan(0n);
    expect(result.payeKobo).toBeGreaterThanOrEqual(0n);
    expect(result.netKobo).toBeLessThan(result.grossKobo);
  });

  it("12 monthly periods reconcile to the one-shot annual computation within rounding tolerance", () => {
    const annualPayComponents = annualComponents(2_400_000, 1_200_000, 720_000);
    const annualRentPaidKobo = naira(900_000);

    let cumulativeChargeableIncomeBeforeKobo = 0n;
    let cumulativePayePaidBeforeKobo = 0n;
    let totalPayeWithheld = 0n;
    let totalNet = 0n;
    let totalGross = 0n;

    for (let month = 1; month <= 12; month++) {
      const result = derivePeriodPayslip(
        {
          annualPayComponents,
          annualRentPaidKobo,
          frequency: "monthly",
          cumulativeChargeableIncomeBeforeKobo,
          cumulativePayePaidBeforeKobo,
        },
        rv,
      );

      totalPayeWithheld += result.payeKobo;
      totalNet += result.netKobo;
      totalGross += result.grossKobo;
      cumulativeChargeableIncomeBeforeKobo = result.chargeableIncomeKobo;
      cumulativePayePaidBeforeKobo += result.payeKobo;
    }

    const annualPaye = computeAnnualPaye(cumulativeChargeableIncomeBeforeKobo, rv).annualPayeKobo;

    // Rounding tolerance: at most a few kobo per component per period from
    // integer division (documented limitation in payslip.ts).
    const diff = annualPaye - totalPayeWithheld;
    expect(diff).toBeGreaterThanOrEqual(0n);
    expect(diff).toBeLessThan(naira(1));

    expect(totalNet + totalPayeWithheld).toBeLessThanOrEqual(totalGross);
  });

  it("mid-year raise recomputes PAYE off the new cumulative position, not a naive slice", () => {
    const lowComponents = annualComponents(1_800_000, 900_000, 540_000);
    const highComponents = annualComponents(4_800_000, 2_400_000, 1_440_000);
    const annualRentPaidKobo = 0n;

    let cumulativeChargeableIncomeBeforeKobo = 0n;
    let cumulativePayePaidBeforeKobo = 0n;

    for (let month = 1; month <= 6; month++) {
      const result = derivePeriodPayslip(
        {
          annualPayComponents: lowComponents,
          annualRentPaidKobo,
          frequency: "monthly",
          cumulativeChargeableIncomeBeforeKobo,
          cumulativePayePaidBeforeKobo,
        },
        rv,
      );
      cumulativeChargeableIncomeBeforeKobo = result.chargeableIncomeKobo;
      cumulativePayePaidBeforeKobo += result.payeKobo;
    }

    const month6Result = derivePeriodPayslip(
      {
        annualPayComponents: lowComponents,
        annualRentPaidKobo,
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    const month7Result = derivePeriodPayslip(
      {
        annualPayComponents: highComponents,
        annualRentPaidKobo,
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo,
        cumulativePayePaidBeforeKobo,
      },
      rv,
    );

    // A naive engine would treat month 7 like any other month at the new
    // salary in isolation — annualize just that month's gross and divide
    // by 12, ignoring the six months of lower-salary history. The
    // cumulative engine instead computes month 7's tax as (tax on the full
    // year-to-date position) minus (tax already withheld in months 1-6),
    // which lands at a materially different figure because the low-salary
    // months left most of the early progressive bands unused.
    const naiveIsolatedMonthlyPaye =
      computeAnnualPaye(month7Result.grossKobo * 12n, rv).annualPayeKobo / 12n;

    expect(month7Result.payeKobo).not.toBe(naiveIsolatedMonthlyPaye);
    expect(month7Result.payeKobo).toBeGreaterThan(0n);
    expect(month7Result.payeKobo).toBeGreaterThan(month6Result.payeKobo);
  });

  it("periodComponents from multiple employees feed computeNsitf's org-level base correctly", () => {
    const employeeA = derivePeriodPayslip(
      {
        annualPayComponents: annualComponents(1_200_000, 600_000, 360_000), // 2,160,000/yr -> 180,000/mo
        annualRentPaidKobo: 0n,
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );
    const employeeB = derivePeriodPayslip(
      {
        annualPayComponents: annualComponents(2_400_000, 1_200_000, 720_000), // 4,320,000/yr -> 360,000/mo
        annualRentPaidKobo: 0n,
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    const nsitf = computeNsitf([employeeA.periodComponents, employeeB.periodComponents], rv);

    // Total monthly payroll base = both employees' period gross combined
    // (both employees' components are entirely "regular" kind here).
    expect(nsitf.totalMonthlyPayrollBaseKobo).toBe(employeeA.grossKobo + employeeB.grossKobo);
    expect(nsitf.totalMonthlyPayrollBaseKobo).toBe(naira(180_000 + 360_000));
    expect(nsitf.employerKobo).toBe(naira(5_400)); // 1% of ₦540,000 combined base
  });
});

describe("deriveLumpSumPayslip (bonus / 13th month) — feature-backlog.md §1's flagged gap", () => {
  it("a 13th-month payment that crosses a PAYE band boundary is taxed more than a flat single-band estimate", () => {
    // Cumulative position sits ₦500,000 below the 18%->21% boundary at
    // ₦12,000,000; a ₦1,000,000 lump sum pushes ₦500,000 of itself into
    // the 21% band. A naive engine that taxed the whole lump sum at the
    // band it started in (18%) would understate this by a real amount.
    const cumulativeChargeableIncomeBeforeKobo = naira(11_500_000);
    const cumulativePayePaidBeforeKobo = computeAnnualPaye(cumulativeChargeableIncomeBeforeKobo, rv).annualPayeKobo;

    const result = deriveLumpSumPayslip(
      {
        kind: "thirteenth_month",
        amountKobo: naira(1_000_000),
        cumulativeChargeableIncomeBeforeKobo,
        cumulativePayePaidBeforeKobo,
      },
      rv,
    );

    const expectedPayeKobo =
      computeAnnualPaye(naira(12_500_000), rv).annualPayeKobo -
      computeAnnualPaye(naira(11_500_000), rv).annualPayeKobo;
    const naiveFlatRatePayeKobo = naira(1_000_000 * 0.18); // if taxed entirely at the pre-lump-sum band's rate

    expect(result.grossKobo).toBe(naira(1_000_000));
    expect(result.chargeableIncomeKobo).toBe(naira(12_500_000));
    expect(result.payeKobo).toBe(expectedPayeKobo);
    expect(result.payeKobo).toBeGreaterThan(naiveFlatRatePayeKobo);
    expect(result.netKobo).toBe(result.grossKobo - result.payeKobo);
  });

  it("is neither pensionable nor in the NHF base — the component's kind/code never matches either allowlist", () => {
    const result = deriveLumpSumPayslip(
      {
        kind: "bonus",
        amountKobo: naira(2_000_000),
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    const pension = computePension(result.periodComponents, rv);
    const nhfKobo = computeNhf(result.periodComponents, rv);

    expect(pension.pensionableBaseKobo).toBe(0n);
    expect(pension.employeeKobo).toBe(0n);
    expect(pension.employerKobo).toBe(0n);
    expect(nhfKobo).toBe(0n);
  });

  it("is excluded from NSITF's base via its kind tag, unlike a regular component", () => {
    const lumpSum = deriveLumpSumPayslip(
      {
        kind: "bonus",
        amountKobo: naira(3_000_000),
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );
    const regular = derivePeriodPayslip(
      {
        annualPayComponents: annualComponents(1_200_000, 600_000, 360_000),
        annualRentPaidKobo: 0n,
        frequency: "monthly",
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    const nsitf = computeNsitf([lumpSum.periodComponents, regular.periodComponents], rv);

    // Only the regular employee's components count toward the base — the
    // bonus contributes nothing, even combined in the same org-level call.
    expect(nsitf.totalMonthlyPayrollBaseKobo).toBe(regular.grossKobo);
  });

  it("net pay never exceeds gross, even at the top marginal band", () => {
    const result = deriveLumpSumPayslip(
      {
        kind: "bonus",
        amountKobo: naira(20_000_000),
        cumulativeChargeableIncomeBeforeKobo: naira(60_000_000), // already in the 25% top band
        cumulativePayePaidBeforeKobo: computeAnnualPaye(naira(60_000_000), rv).annualPayeKobo,
      },
      rv,
    );

    expect(result.netKobo).toBeLessThan(result.grossKobo);
    expect(result.netKobo).toBeGreaterThanOrEqual(0n);
  });
});

describe("deriveLumpSumPayslip (final settlement: leave encashment + gratuity, kind 'one_off')", () => {
  it("a combined leave-payout + gratuity settlement that crosses a PAYE band boundary is taxed on top of year-to-date, not in isolation", () => {
    // Same band-boundary scenario as the 13th-month case, but for a
    // terminated employee's settlement: feature-backlog.md flags both
    // "leave encashment and its tax treatment" and "termination payments:
    // gratuity is taxable under the new Act" as needing exactly this
    // cumulative-carry-forward coverage, combined into one "one_off" payout.
    const cumulativeChargeableIncomeBeforeKobo = naira(11_500_000);
    const cumulativePayePaidBeforeKobo = computeAnnualPaye(cumulativeChargeableIncomeBeforeKobo, rv).annualPayeKobo;

    const leavePayoutKobo = naira(400_000);
    const gratuityKobo = naira(600_000);

    const result = deriveLumpSumPayslip(
      {
        kind: "one_off",
        amountKobo: leavePayoutKobo + gratuityKobo,
        cumulativeChargeableIncomeBeforeKobo,
        cumulativePayePaidBeforeKobo,
      },
      rv,
    );

    const expectedPayeKobo =
      computeAnnualPaye(naira(12_500_000), rv).annualPayeKobo -
      computeAnnualPaye(naira(11_500_000), rv).annualPayeKobo;
    const naiveFlatRatePayeKobo = naira(1_000_000 * 0.18); // if taxed entirely at the pre-settlement band's rate

    expect(result.grossKobo).toBe(naira(1_000_000));
    expect(result.chargeableIncomeKobo).toBe(naira(12_500_000));
    expect(result.payeKobo).toBe(expectedPayeKobo);
    expect(result.payeKobo).toBeGreaterThan(naiveFlatRatePayeKobo);
    expect(result.netKobo).toBe(result.grossKobo - result.payeKobo);
  });

  it("is neither pensionable nor in the NHF base — a terminated employee's settlement never re-triggers active-employment deductions", () => {
    const result = deriveLumpSumPayslip(
      {
        kind: "one_off",
        amountKobo: naira(1_500_000),
        cumulativeChargeableIncomeBeforeKobo: 0n,
        cumulativePayePaidBeforeKobo: 0n,
      },
      rv,
    );

    const pension = computePension(result.periodComponents, rv);
    const nhfKobo = computeNhf(result.periodComponents, rv);

    expect(pension.pensionableBaseKobo).toBe(0n);
    expect(pension.employeeKobo).toBe(0n);
    expect(pension.employerKobo).toBe(0n);
    expect(nhfKobo).toBe(0n);
  });

  it("ignoring the employee's cumulative chargeable income before the settlement would understate PAYE — guards the exact bug class in settle/compute.ts", () => {
    // If a caller passed only the settlement amount itself as "chargeable
    // income" (i.e. treated cumulativeChargeableIncomeBeforeKobo as 0
    // rather than the employee's real year-to-date position), the result
    // would be taxed as if the settlement were the employee's only income
    // of the year — always understating PAYE once the employee has earned
    // anything at all this year. This test locks in that the two must
    // differ whenever prior income is nonzero, so a regression that drops
    // the carry-forward (as settle/compute.ts's pre-refactor version did)
    // fails loudly here rather than silently under-taxing a real payout.
    const cumulativeChargeableIncomeBeforeKobo = naira(9_000_000);
    const cumulativePayePaidBeforeKobo = computeAnnualPaye(cumulativeChargeableIncomeBeforeKobo, rv).annualPayeKobo;
    const amountKobo = naira(1_000_000);

    const correct = deriveLumpSumPayslip(
      { kind: "one_off", amountKobo, cumulativeChargeableIncomeBeforeKobo, cumulativePayePaidBeforeKobo },
      rv,
    );
    const asIfOnlyIncomeThisYear = deriveLumpSumPayslip(
      { kind: "one_off", amountKobo, cumulativeChargeableIncomeBeforeKobo: 0n, cumulativePayePaidBeforeKobo: 0n },
      rv,
    );

    expect(correct.payeKobo).toBeGreaterThan(asIfOnlyIncomeThisYear.payeKobo);
  });

  it("net pay never exceeds gross, even at the top marginal band", () => {
    const result = deriveLumpSumPayslip(
      {
        kind: "one_off",
        amountKobo: naira(20_000_000),
        cumulativeChargeableIncomeBeforeKobo: naira(60_000_000), // already in the 25% top band
        cumulativePayePaidBeforeKobo: computeAnnualPaye(naira(60_000_000), rv).annualPayeKobo,
      },
      rv,
    );

    expect(result.netKobo).toBeLessThan(result.grossKobo);
    expect(result.netKobo).toBeGreaterThanOrEqual(0n);
  });
});
