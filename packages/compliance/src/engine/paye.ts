import { applyRate, clampNonNegative, min, type Kobo } from "../money";
import type { PayeBand } from "../types";

/**
 * Marginal band tax: only the slice of `chargeableIncome` that falls inside
 * each band is taxed at that band's rate. Order matters — this must run on
 * chargeable income (after reliefs), never on gross.
 */
export function calculatePaye(chargeableIncome: Kobo, bands: readonly PayeBand[]): Kobo {
  if (chargeableIncome <= 0n) return 0n;

  let tax = 0n;
  let consumed = 0n;

  for (const band of bands) {
    if (consumed >= chargeableIncome) break;

    const bandCeiling = band.upTo ?? chargeableIncome;
    const bandTop = bandCeiling < chargeableIncome ? bandCeiling : chargeableIncome;
    const incomeInBand = bandTop - consumed;

    if (incomeInBand > 0n) {
      tax += applyRate(incomeInBand, band.rate);
    }
    consumed = bandTop;
  }

  return tax;
}

/** Rent relief = min(annual rent × rate, cap). */
export function calculateRentRelief(annualRent: Kobo, params: { rate: number; cap: Kobo }): Kobo {
  const uncapped = applyRate(clampNonNegative(annualRent), params.rate);
  return min(uncapped, params.cap);
}

/**
 * Chargeable income = max(0, gross − pension(EE) − NHF − rent relief).
 * Never negative.
 */
export function calculateChargeableIncome(params: {
  gross: Kobo;
  pensionEmployee: Kobo;
  nhf: Kobo;
  rentRelief: Kobo;
}): Kobo {
  const chargeable = params.gross - params.pensionEmployee - params.nhf - params.rentRelief;
  return clampNonNegative(chargeable);
}

/**
 * Cumulative PAYE for one pay period: recomputes tax on the full year-to-date
 * chargeable income, then subtracts PAYE already paid this year. This must
 * be re-derived whenever pay changes mid-year — never a naive monthly slice
 * of the current period's income alone.
 */
export function calculateCumulativePayePeriod(params: {
  cumulativeChargeableIncomeBeforePeriod: Kobo;
  periodChargeableIncome: Kobo;
  cumulativePayeAlreadyPaid: Kobo;
  bands: readonly PayeBand[];
}): Kobo {
  const newCumulativeChargeable =
    params.cumulativeChargeableIncomeBeforePeriod + params.periodChargeableIncome;
  const totalPayeDueYtd = calculatePaye(newCumulativeChargeable, params.bands);
  const periodPaye = totalPayeDueYtd - params.cumulativePayeAlreadyPaid;
  return clampNonNegative(periodPaye);
}
