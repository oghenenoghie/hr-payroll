import { applyRate, naira, type Kobo } from "./money.js";
import { computeAnnualPaye, computeRentRelief, deriveChargeableIncome } from "./schemes/paye.js";
import type { PayComponent, RuleVersion } from "./types.js";

/**
 * The illustrative 50/30/20 gross split from the PAYE Calculator screen.
 * DEMO ONLY — production must read each employee's actual basic/housing/
 * transport as constituted, never a derived percentage of gross. See
 * nigeria-statutory-compliance.md §2's caveat: this split coincidentally
 * makes pensionable pay equal gross, which will not hold with real data.
 */
export function demoSplitGrossIntoComponents(annualGrossKobo: Kobo): PayComponent[] {
  return [
    { code: "basic", amountKobo: (annualGrossKobo * 50n) / 100n, kind: "regular" },
    { code: "housing", amountKobo: (annualGrossKobo * 30n) / 100n, kind: "regular" },
    { code: "transport", amountKobo: (annualGrossKobo * 20n) / 100n, kind: "regular" },
  ];
}

export interface DemoPayeDerivation {
  annualGrossKobo: Kobo;
  payComponents: PayComponent[];
  pensionableBaseKobo: Kobo;
  pensionEmployeeKobo: Kobo;
  pensionEmployerKobo: Kobo;
  nhfKobo: Kobo;
  rentReliefKobo: Kobo;
  chargeableIncomeKobo: Kobo;
  annualPayeKobo: Kobo;
  monthlyPayeKobo: Kobo;
}

/** Reproduces the four-step derivation the PAYE Calculator screen displays,
 * from a single annual gross + annual rent — the only screen in the
 * prototype needing zero persistence. */
export function deriveDemoPaye(
  annualGrossKobo: Kobo,
  annualRentPaidKobo: Kobo,
  ruleVersion: RuleVersion,
): DemoPayeDerivation {
  const payComponents = demoSplitGrossIntoComponents(annualGrossKobo);
  const pensionableBaseKobo = payComponents
    .filter((c) => ruleVersion.pension.baseComponentCodes.includes(c.code))
    .reduce((sum, c) => sum + c.amountKobo, 0n);
  const pensionEmployeeKobo = applyRate(pensionableBaseKobo, ruleVersion.pension.employeeRateScaled);
  const pensionEmployerKobo = applyRate(pensionableBaseKobo, ruleVersion.pension.employerRateScaled);
  const basicKobo = payComponents.find((c) => c.code === "basic")?.amountKobo ?? 0n;
  const nhfKobo = applyRate(basicKobo, ruleVersion.nhf.rateScaled);
  const rentReliefKobo = computeRentRelief(annualRentPaidKobo, ruleVersion);

  const chargeableIncomeKobo = deriveChargeableIncome(
    { annualGrossKobo, pensionEmployeeKobo, nhfKobo, annualRentPaidKobo },
    ruleVersion,
  );
  const { annualPayeKobo } = computeAnnualPaye(chargeableIncomeKobo, ruleVersion);

  return {
    annualGrossKobo,
    payComponents,
    pensionableBaseKobo,
    pensionEmployeeKobo,
    pensionEmployerKobo,
    nhfKobo,
    rentReliefKobo,
    chargeableIncomeKobo,
    annualPayeKobo,
    monthlyPayeKobo: annualPayeKobo / 12n,
  };
}

export const demoNaira = naira;
