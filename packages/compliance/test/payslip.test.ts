import { describe, expect, it } from "vitest";
import { naira } from "../src/money";
import { NG_2026_1 } from "../src/rule-versions/ng-2026.1";
import { computeAnnualPaye } from "../src/schemes/paye";
import { computeNsitf } from "../src/schemes/nsitf";
import { derivePeriodPayslip } from "../src/payslip";
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
