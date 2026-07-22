import { describe, expect, it } from "vitest";
import { calculateNhf } from "../../src/engine/nhf.js";
import { calculateItf } from "../../src/engine/itf.js";
import { calculateNsitf } from "../../src/engine/nsitf.js";
import { calculatePension } from "../../src/engine/pension.js";
import { computePayslip } from "../../src/engine/payslip.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

const components = {
  basic: nairaToKobo(300_000),
  housing: nairaToKobo(150_000),
  transport: nairaToKobo(50_000),
};

describe("Each scheme calculates against its own base", () => {
  it("pension base is basic + housing + transport", () => {
    const pension = calculatePension(components, NG_2026_1.pension);
    expect(pension.pensionable).toBe(nairaToKobo(500_000));
    expect(pension.employee).toBe(nairaToKobo(40_000)); // 8%
    expect(pension.employer).toBe(nairaToKobo(50_000)); // 10%
  });

  it("NHF base is basic salary only — housing and transport don't affect it", () => {
    const nhf = calculateNhf(components, NG_2026_1.nhf);
    expect(nhf).toBe(nairaToKobo(7_500)); // 2.5% of ₦300,000 basic

    const withDifferentHousing = calculateNhf(
      { ...components, housing: nairaToKobo(999_999), transport: nairaToKobo(999_999) },
      NG_2026_1.nhf,
    );
    expect(withDifferentHousing).toBe(nhf);
  });

  it("NSITF bases on total monthly payroll, not any individual employee's pay", () => {
    const totalMonthlyPayroll = nairaToKobo(10_000_000);
    const nsitf = calculateNsitf(totalMonthlyPayroll, NG_2026_1.nsitf);
    expect(nsitf).toBe(nairaToKobo(100_000)); // 1%
  });

  it("ITF bases on annual payroll and only applies to qualifying employers", () => {
    const annualPayroll = nairaToKobo(120_000_000);

    const qualifying = calculateItf(annualPayroll, { employeeCount: 20, annualPayrollKobo: annualPayroll }, NG_2026_1.itf);
    expect(qualifying.qualifies).toBe(true);
    expect(qualifying.amount).toBe(nairaToKobo(1_200_000)); // 1%

    const nonQualifying = calculateItf(
      annualPayroll,
      { employeeCount: 2, annualPayrollKobo: nairaToKobo(10_000_000) },
      NG_2026_1.itf,
    );
    expect(nonQualifying.qualifies).toBe(false);
    expect(nonQualifying.amount).toBe(0n);
  });
});

describe("Employer-borne costs never land in an employee's deduction total", () => {
  it("a payslip's employeeDeductions excludes employer pension cost", () => {
    const payslip = computePayslip(
      {
        components,
        annualRent: nairaToKobo(1_200_000),
        cumulativeChargeableIncomeBeforePeriod: 0n,
        cumulativePayeAlreadyPaid: 0n,
      },
      NG_2026_1,
    );

    expect(payslip.pensionEmployer).toBeGreaterThan(0n);
    expect(payslip.employeeDeductions).toBe(payslip.pensionEmployee + payslip.nhf + payslip.paye);
    expect(payslip.net).toBe(payslip.gross - payslip.employeeDeductions);

    // Structural guarantee: the payslip shape has no field an employer-cost
    // line (NSITF, ITF, pension ER) could be smuggled into net via.
    expect(Object.keys(payslip)).not.toContain("nsitf");
    expect(Object.keys(payslip)).not.toContain("itf");
  });
});
