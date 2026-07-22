import { applyRate, clampNonNegative, type Kobo } from "../money";
import type { RuleVersion } from "../types";

export interface PayeBandResult {
  upToKobo: Kobo | null;
  rateScaled: bigint;
  taxableInBandKobo: Kobo;
  taxInBandKobo: Kobo;
}

export interface AnnualPayeResult {
  chargeableIncomeKobo: Kobo;
  bands: PayeBandResult[];
  annualPayeKobo: Kobo;
}

/**
 * Bands the given chargeable income and sums marginal tax per band.
 * Pure function: no employee/TIN concerns here — see deriveChargeableIncome
 * for the gate. Never negative; income at/below the first band's upTo yields 0.
 */
export function computeAnnualPaye(chargeableIncomeKobo: Kobo, ruleVersion: RuleVersion): AnnualPayeResult {
  const chargeable = clampNonNegative(chargeableIncomeKobo);
  const bands: PayeBandResult[] = [];
  let floor = 0n;
  let remaining = chargeable;

  for (const band of ruleVersion.paye.bands) {
    const ceiling = band.upToKobo === null ? null : band.upToKobo;
    const bandWidth = ceiling === null ? remaining : ceiling - floor;
    const taxableInBand = remaining < bandWidth ? remaining : bandWidth;
    const taxInBand = taxableInBand > 0n ? applyRate(taxableInBand, band.rateScaled) : 0n;

    bands.push({ upToKobo: band.upToKobo, rateScaled: band.rateScaled, taxableInBandKobo: taxableInBand, taxInBandKobo: taxInBand });

    remaining -= taxableInBand;
    if (ceiling !== null) floor = ceiling;
    if (remaining <= 0n) break;
  }

  const annualPayeKobo = bands.reduce((sum, b) => sum + b.taxInBandKobo, 0n);
  return { chargeableIncomeKobo: chargeable, bands, annualPayeKobo };
}

export interface ChargeableIncomeInput {
  annualGrossKobo: Kobo;
  pensionEmployeeKobo: Kobo;
  nhfKobo: Kobo;
  annualRentPaidKobo: Kobo;
}

export function computeRentRelief(annualRentPaidKobo: Kobo, ruleVersion: RuleVersion): Kobo {
  const uncapped = applyRate(annualRentPaidKobo, ruleVersion.paye.rentRelief.rateScaled);
  return uncapped > ruleVersion.paye.rentRelief.capKobo ? ruleVersion.paye.rentRelief.capKobo : uncapped;
}

/** Order matters: pension + NHF + rent relief are deducted from gross *before* banding. */
export function deriveChargeableIncome(input: ChargeableIncomeInput, ruleVersion: RuleVersion): Kobo {
  const rentRelief = computeRentRelief(input.annualRentPaidKobo, ruleVersion);
  return clampNonNegative(
    input.annualGrossKobo - input.pensionEmployeeKobo - input.nhfKobo - rentRelief,
  );
}

/**
 * Cumulative PAYE for the current period: recompute annual PAYE on
 * year-to-date chargeable income, then subtract tax already withheld this
 * year. Never a naive monthly slice of gross — a mid-year pay change or an
 * off-cycle payment recalculates the whole year-to-date position.
 */
export function computeCumulativePeriodPaye(
  ytdChargeableIncomeKobo: Kobo,
  payeAlreadyWithheldYtdKobo: Kobo,
  ruleVersion: RuleVersion,
): Kobo {
  const ytdPaye = computeAnnualPaye(ytdChargeableIncomeKobo, ruleVersion).annualPayeKobo;
  return clampNonNegative(ytdPaye - payeAlreadyWithheldYtdKobo);
}
