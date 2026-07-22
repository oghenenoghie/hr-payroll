import { clampNonNegative, sumKobo, type Kobo } from "./money";
import type { PayComponent, RuleVersion } from "./types";
import { computeCumulativePeriodPaye, computeRentRelief } from "./schemes/paye";
import { computePension } from "./schemes/pension";
import { computeNhf } from "./schemes/nhf";

export type PayFrequency = "weekly" | "biweekly" | "monthly";

const PERIODS_PER_YEAR: Record<PayFrequency, bigint> = {
  weekly: 52n,
  biweekly: 26n,
  monthly: 12n,
};

export interface PeriodPayslipInput {
  /** Employee's annual pay components, as actually configured — never a derived split. */
  annualPayComponents: PayComponent[];
  annualRentPaidKobo: Kobo;
  frequency: PayFrequency;
  /** State carried from the employee's most recent prior payslip; 0/0 for their first ever run. */
  cumulativeChargeableIncomeBeforeKobo: Kobo;
  cumulativePayePaidBeforeKobo: Kobo;
}

export interface PeriodPayslipResult {
  grossKobo: Kobo;
  pensionableKobo: Kobo;
  pensionEmployeeKobo: Kobo;
  pensionEmployerKobo: Kobo;
  nhfKobo: Kobo;
  rentReliefKobo: Kobo;
  /** Cumulative year-to-date chargeable income as of (including) this period — not a period-only figure. */
  chargeableIncomeKobo: Kobo;
  /** This period's own incremental PAYE — already net of tax withheld earlier in the year. */
  payeKobo: Kobo;
  employeeDeductionsKobo: Kobo;
  netKobo: Kobo;
  /** This period's prorated pay components — the correct input for org-level,
   * per-period schemes (e.g. NSITF's total-monthly-payroll base) so callers
   * never have to re-derive the proration themselves. */
  periodComponents: PayComponent[];
}

/**
 * Divides an annual figure into this pay frequency's periods. Integer
 * division truncates any remainder kobo — over a full year this drifts by
 * at most a few kobo per component, which a production system should true
 * up on the year's final period rather than let compound. Not done here;
 * flagging it rather than shipping it silently.
 */
function proratePerPeriod(annualKobo: Kobo, periodsPerYear: bigint): Kobo {
  return annualKobo / periodsPerYear;
}

/**
 * Derives one pay period's payslip for a single employee. Cumulative PAYE
 * throughout: chargeable income accumulates year-to-date and PAYE is
 * re-derived from the full cumulative position every period via
 * computeCumulativePeriodPaye — never a naive monthly slice of the annual
 * figure. TIN gating is the caller's responsibility (see tin-gate.ts);
 * this function assumes it has already been checked.
 */
export function derivePeriodPayslip(input: PeriodPayslipInput, ruleVersion: RuleVersion): PeriodPayslipResult {
  const periodsPerYear = PERIODS_PER_YEAR[input.frequency];

  const periodComponents: PayComponent[] = input.annualPayComponents.map((component) => ({
    ...component,
    amountKobo: proratePerPeriod(component.amountKobo, periodsPerYear),
  }));
  const grossKobo = sumKobo(periodComponents.map((c) => c.amountKobo));

  const pension = computePension(periodComponents, ruleVersion);
  const nhfKobo = computeNhf(periodComponents, ruleVersion);
  const rentReliefKobo = proratePerPeriod(computeRentRelief(input.annualRentPaidKobo, ruleVersion), periodsPerYear);

  const periodChargeableAddition = clampNonNegative(grossKobo - pension.employeeKobo - nhfKobo - rentReliefKobo);
  const chargeableIncomeKobo = input.cumulativeChargeableIncomeBeforeKobo + periodChargeableAddition;

  const payeKobo = computeCumulativePeriodPaye(chargeableIncomeKobo, input.cumulativePayePaidBeforeKobo, ruleVersion);

  const employeeDeductionsKobo = pension.employeeKobo + nhfKobo + payeKobo;
  const netKobo = clampNonNegative(grossKobo - employeeDeductionsKobo);

  return {
    grossKobo,
    pensionableKobo: pension.pensionableBaseKobo,
    pensionEmployeeKobo: pension.employeeKobo,
    pensionEmployerKobo: pension.employerKobo,
    nhfKobo,
    rentReliefKobo,
    chargeableIncomeKobo,
    payeKobo,
    employeeDeductionsKobo,
    netKobo,
    periodComponents,
  };
}
