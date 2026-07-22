import { applyRate, type Kobo } from "../money";
import type { RuleVersion } from "../types";

/**
 * NSITF is an organisation-level liability on total monthly payroll, borne
 * entirely by the employer. It never appears in any employee's deductions.
 */
export function calculateNsitf(totalMonthlyPayroll: Kobo, rules: RuleVersion["nsitf"]): Kobo {
  return applyRate(totalMonthlyPayroll, rules.rate);
}
