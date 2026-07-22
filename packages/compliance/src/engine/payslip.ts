import { clampNonNegative, sum, type Kobo } from "../money";
import type { PayComponents, RuleVersion } from "../types";
import { calculateChargeableIncome, calculateCumulativePayePeriod, calculateRentRelief } from "./paye";
import { calculateNhf } from "./nhf";
import { calculatePension } from "./pension";

export interface PayslipInput {
  components: PayComponents;
  annualRent: Kobo;
  cumulativeChargeableIncomeBeforePeriod: Kobo;
  cumulativePayeAlreadyPaid: Kobo;
}

export interface PayslipDerivation {
  gross: Kobo;
  pensionable: Kobo;
  pensionEmployee: Kobo;
  /** Employer cost — kept out of `employeeDeductions` and out of `net`. */
  pensionEmployer: Kobo;
  nhf: Kobo;
  rentRelief: Kobo;
  chargeableIncomeThisPeriod: Kobo;
  paye: Kobo;
  employeeDeductions: Kobo;
  net: Kobo;
}

/**
 * Runs the full derivation order for one employee, one pay period, per
 * README §7: basic/housing/transport → pensionable → pension → NHF →
 * rent relief → chargeable income → cumulative PAYE. Employer-borne costs
 * (pension ER) are returned separately and never folded into the employee
 * total.
 */
export function computePayslip(input: PayslipInput, rules: RuleVersion): PayslipDerivation {
  const gross = sum([input.components.basic, input.components.housing, input.components.transport]);

  const pension = calculatePension(input.components, rules.pension);
  const nhf = calculateNhf(input.components, rules.nhf);
  const rentRelief = calculateRentRelief(input.annualRent, rules.paye.rentRelief);

  const chargeableIncomeThisPeriod = calculateChargeableIncome({
    gross,
    pensionEmployee: pension.employee,
    nhf,
    rentRelief,
  });

  const paye = calculateCumulativePayePeriod({
    cumulativeChargeableIncomeBeforePeriod: input.cumulativeChargeableIncomeBeforePeriod,
    periodChargeableIncome: chargeableIncomeThisPeriod,
    cumulativePayeAlreadyPaid: input.cumulativePayeAlreadyPaid,
    bands: rules.paye.bands,
  });

  const employeeDeductions = sum([pension.employee, nhf, paye]);
  const net = clampNonNegative(gross - employeeDeductions);

  return {
    gross,
    pensionable: pension.pensionable,
    pensionEmployee: pension.employee,
    pensionEmployer: pension.employer,
    nhf,
    rentRelief,
    chargeableIncomeThisPeriod,
    paye,
    employeeDeductions,
    net,
  };
}
