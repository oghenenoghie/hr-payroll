import { applyRate, type Kobo } from "../money";
import type { PayComponents, RuleVersion } from "../types";
import { sumPayComponents } from "./base";

export interface PensionResult {
  pensionable: Kobo;
  employee: Kobo;
  /** Employer cost — never included in an employee's deduction total. */
  employer: Kobo;
}

export function calculatePension(
  components: PayComponents,
  rules: RuleVersion["pension"],
): PensionResult {
  const pensionable = sumPayComponents(components, rules.base);
  return {
    pensionable,
    employee: applyRate(pensionable, rules.employeeRate),
    employer: applyRate(pensionable, rules.employerRate),
  };
}
