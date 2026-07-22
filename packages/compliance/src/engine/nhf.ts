import { applyRate, type Kobo } from "../money";
import type { PayComponents, RuleVersion } from "../types";
import { sumPayComponents } from "./base";

export function calculateNhf(components: PayComponents, rules: RuleVersion["nhf"]): Kobo {
  const base = sumPayComponents(components, rules.base);
  return applyRate(base, rules.rate);
}
