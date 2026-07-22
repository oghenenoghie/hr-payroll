import { applyRate, type Kobo } from "../money";
import type { RuleVersion } from "../types";

export class UnknownWhtCategoryError extends Error {
  constructor(public readonly category: string) {
    super(`No WHT rate configured for category "${category}" — resolve by category, never apply a flat rate.`);
    this.name = "UnknownWhtCategoryError";
  }
}

/** Rate resolved strictly by service category — never a flat rate. */
export function computeWht(paymentKobo: Kobo, category: string, ruleVersion: RuleVersion): Kobo {
  const rateScaled = ruleVersion.wht.ratesScaledByCategory[category];
  if (rateScaled === undefined) throw new UnknownWhtCategoryError(category);
  return applyRate(paymentKobo, rateScaled);
}
