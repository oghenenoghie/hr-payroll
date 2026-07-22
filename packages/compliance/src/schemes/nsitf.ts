import { applyRate, sumKobo, type Kobo } from "../money.js";
import type { PayComponent, RuleVersion } from "../types.js";

export interface NsitfResult {
  totalMonthlyPayrollBaseKobo: Kobo;
  employerKobo: Kobo;
}

/**
 * Base = total monthly payroll, excluding pension contributions, bonuses,
 * overtime, and one-off payments such as 13th-month income. Employer-borne —
 * never appears in an employee's deduction total.
 */
export function computeNsitf(allEmployeesPayComponents: PayComponent[][], ruleVersion: RuleVersion): NsitfResult {
  const totalMonthlyPayrollBaseKobo = sumKobo(
    allEmployeesPayComponents.flatMap((components) =>
      components.filter((c) => c.kind === "regular").map((c) => c.amountKobo),
    ),
  );
  return {
    totalMonthlyPayrollBaseKobo,
    employerKobo: applyRate(totalMonthlyPayrollBaseKobo, ruleVersion.nsitf.rateScaled),
  };
}
