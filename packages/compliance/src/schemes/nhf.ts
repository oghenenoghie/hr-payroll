import { applyRate, sumKobo, type Kobo } from "../money";
import type { PayComponent, RuleVersion } from "../types";

/** Base is basic salary only — do not reuse pension's basic+housing+transport base. */
export function computeNhf(payComponents: PayComponent[], ruleVersion: RuleVersion): Kobo {
  const base = sumKobo(
    payComponents.filter((c) => ruleVersion.nhf.baseComponentCodes.includes(c.code)).map((c) => c.amountKobo),
  );
  return applyRate(base, ruleVersion.nhf.rateScaled);
}
