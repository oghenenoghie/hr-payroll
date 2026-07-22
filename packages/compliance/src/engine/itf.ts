import { applyRate, type Kobo } from "../money";
import type { Org, RuleVersion } from "../types";

/**
 * ITF is an organisation-level, employer-borne liability on annual payroll,
 * due only from qualifying employers. Non-qualifying employers owe zero.
 */
export function calculateItf(
  annualPayroll: Kobo,
  org: Org,
  rules: RuleVersion["itf"],
): { qualifies: boolean; amount: Kobo } {
  const qualifies = rules.qualifies(org);
  return {
    qualifies,
    amount: qualifies ? applyRate(annualPayroll, rules.rate) : 0n,
  };
}
