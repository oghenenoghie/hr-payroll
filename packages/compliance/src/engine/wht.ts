import { applyRate, type Kobo } from "../money";
import type { RuleVersion } from "../types";

export class UnknownWhtCategoryError extends Error {
  constructor(category: string) {
    super(`No WHT rate configured for category: ${category}`);
    this.name = "UnknownWhtCategoryError";
  }
}

/** Withholding tax is borne by the contractor/vendor, not the paying org. */
export function calculateWht(
  paymentAmount: Kobo,
  category: string,
  rules: RuleVersion["wht"],
): Kobo {
  const rate = rules.ratesByCategory[category];
  if (rate === undefined) {
    throw new UnknownWhtCategoryError(category);
  }
  return applyRate(paymentAmount, rate);
}
