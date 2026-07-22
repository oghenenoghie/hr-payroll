import { applyRate, sumKobo, type Kobo } from "../money";
import type { PayComponent, RuleVersion } from "../types";

export interface PensionResult {
  pensionableBaseKobo: Kobo;
  employeeKobo: Kobo;
  employerKobo: Kobo;
}

function baseFrom(components: PayComponent[], codes: readonly string[]): Kobo {
  return sumKobo(components.filter((c) => codes.includes(c.code)).map((c) => c.amountKobo));
}

/** Base is basic + housing + transport as actually constituted — never a
 * derived percentage of gross. */
export function computePension(payComponents: PayComponent[], ruleVersion: RuleVersion): PensionResult {
  const pensionableBaseKobo = baseFrom(payComponents, ruleVersion.pension.baseComponentCodes);
  return {
    pensionableBaseKobo,
    employeeKobo: applyRate(pensionableBaseKobo, ruleVersion.pension.employeeRateScaled),
    employerKobo: applyRate(pensionableBaseKobo, ruleVersion.pension.employerRateScaled),
  };
}
