import { applyRate, naira, type Kobo } from "./money";
import { computeAnnualPaye, computeRentRelief, deriveChargeableIncome } from "./schemes/paye";
import type { PayComponent, RuleVersion } from "./types";

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

const GROSS_UP_MAX_ITERATIONS = 100;

export interface GrossUpResult {
  annualGrossKobo: Kobo;
  netKobo: Kobo;
  derivation: DemoPayeDerivation;
  iterations: number;
}

/**
 * Solves for the annual gross that delivers (at least) a target annual net
 * — the "gross-up" calculation common in Nigerian senior/expatriate
 * contracts where the employer guarantees a take-home figure and bears the
 * tax on top. DEMO ONLY, same 50/30/20 split caveat as deriveDemoPaye:
 * production gross-up (against a real employee's actual basic/housing/
 * transport) is a separate, unbuilt feature — see feature-backlog.md §1.
 *
 * PAYE is progressive, so net is a function of gross with no closed-form
 * inverse; this solves it with integer binary search rather than a
 * numerical (float) iteration, consistent with this package's
 * integer-only money rule. net(gross) is non-decreasing in gross (every
 * deduction here is a proportional rate strictly under 100%, so a higher
 * gross never yields a lower net), which is what makes binary search
 * valid. It converges to the *smallest* gross whose derived net meets or
 * exceeds the target — the employer is never short of the promise, at
 * the cost of at most a few kobo of rounding in the employer's favour.
 * Capped at GROSS_UP_MAX_ITERATIONS (a range up to hundreds of billions
 * of kobo resolves in under 40) and throws rather than returning a
 * silently wrong answer if that cap is ever hit.
 */
export function solveDemoGrossForNet(
  targetAnnualNetKobo: Kobo,
  annualRentPaidKobo: Kobo,
  ruleVersion: RuleVersion,
): GrossUpResult {
  if (targetAnnualNetKobo <= 0n) {
    throw new Error("Target net pay must be greater than zero.");
  }

  const netForGross = (annualGrossKobo: Kobo) => {
    const derivation = deriveDemoPaye(annualGrossKobo, annualRentPaidKobo, ruleVersion);
    const netKobo = annualGrossKobo - derivation.pensionEmployeeKobo - derivation.nhfKobo - derivation.annualPayeKobo;
    return { derivation, netKobo };
  };

  // Net can never exceed gross, so gross is at least the target net.
  // Upper bound adds generous headroom past every band and relief so the
  // search range is guaranteed to bracket the answer even at extreme
  // inputs, without needing to reason about the exact marginal rate.
  let lowKobo = targetAnnualNetKobo;
  let highKobo = targetAnnualNetKobo * 2n + naira(50_000_000);
  let iterations = 0;

  while (lowKobo < highKobo && iterations < GROSS_UP_MAX_ITERATIONS) {
    const midKobo = lowKobo + (highKobo - lowKobo) / 2n;
    const { netKobo } = netForGross(midKobo);
    iterations += 1;
    if (netKobo >= targetAnnualNetKobo) {
      highKobo = midKobo;
    } else {
      lowKobo = midKobo + 1n;
    }
  }

  if (lowKobo < highKobo) {
    throw new Error(`Gross-up did not converge within ${GROSS_UP_MAX_ITERATIONS} iterations.`);
  }

  const { derivation, netKobo } = netForGross(lowKobo);
  return { annualGrossKobo: lowKobo, netKobo, derivation, iterations };
}

export const demoNaira = naira;
