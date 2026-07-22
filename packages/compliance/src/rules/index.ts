import type { RuleVersion } from "../types";
import { NG_2026_1 } from "./ng-2026.1";

const RULE_VERSIONS: readonly RuleVersion[] = [NG_2026_1];

export class RuleVersionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleVersionNotFoundError";
  }
}

export function getRuleVersion(id: string): RuleVersion {
  const found = RULE_VERSIONS.find((rule) => rule.id === id);
  if (!found) {
    throw new RuleVersionNotFoundError(`Unknown rule version: ${id}`);
  }
  return found;
}

/** Resolves the rule version whose validity window `[effectiveFrom, effectiveTo)` covers `asOf`. */
export function resolveRuleVersion(country: string, asOf: string): RuleVersion {
  const iso = asOf;
  const found = RULE_VERSIONS.find(
    (rule) =>
      rule.country === country &&
      rule.effectiveFrom <= iso &&
      (rule.effectiveTo === null || iso < rule.effectiveTo),
  );
  if (!found) {
    throw new RuleVersionNotFoundError(`No rule version for ${country} effective as of ${asOf}`);
  }
  return found;
}

export { NG_2026_1 };
