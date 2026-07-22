import { applyRate, type Kobo } from "../money";
import type { OrgStatutoryProfile, RuleVersion } from "../types";

export interface ItfResult {
  qualifies: boolean;
  annualPayrollBaseKobo: Kobo;
  employerKobo: Kobo;
}

/** Qualification is threshold data, not a callback — encoded here (confirm
 * the current test against ITF guidance before go-live). Employer-borne. */
export function computeItf(
  annualPayrollBaseKobo: Kobo,
  org: OrgStatutoryProfile,
  ruleVersion: RuleVersion,
): ItfResult {
  const { minEmployees, minAnnualTurnoverKobo } = ruleVersion.itf.qualifyingThreshold;
  const qualifies = org.employeeCount >= minEmployees || org.annualTurnoverKobo >= minAnnualTurnoverKobo;
  return {
    qualifies,
    annualPayrollBaseKobo,
    employerKobo: qualifies ? applyRate(annualPayrollBaseKobo, ruleVersion.itf.rateScaled) : 0n,
  };
}
