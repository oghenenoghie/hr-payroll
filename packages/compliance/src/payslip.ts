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

export type LumpSumKind = "bonus" | "thirteenth_month" | "one_off";

export interface LumpSumPayslipInput {
  kind: LumpSumKind;
  amountKobo: Kobo;
  /** State carried from the employee's most recent prior payslip — a lump
   * sum is taxed on top of whatever the employee has already earned this
   * year, never as if it were their only income. */
  cumulativeChargeableIncomeBeforeKobo: Kobo;
  cumulativePayePaidBeforeKobo: Kobo;
}

export interface LumpSumPayslipResult {
  grossKobo: Kobo;
  chargeableIncomeKobo: Kobo;
  payeKobo: Kobo;
  netKobo: Kobo;
  periodComponents: PayComponent[];
}

/**
 * Derives a standalone lump-sum payslip — bonus, 13th month, or a final
 * settlement's combined leave-encashment + gratuity payout (kind
 * "one_off") — added whole to this period (no proration by frequency,
 * unlike derivePeriodPayslip), taxed via the same cumulative-PAYE
 * mechanism so it correctly pushes the employee's year-to-date position
 * into a higher marginal band when it's large enough to (feature-
 * backlog.md §1's specifically-flagged case, called out separately for
 * both the 13th-month scenario and "termination payments: gratuity is
 * taxable under the new Act").
 *
 * Deliberately not pensionable and outside the NHF base: the component is
 * tagged with `kind` (never "regular") and coded to match, so
 * computePension (basic/housing/transport only) and computeNhf (basic
 * only) naturally compute zero against it without a special case here —
 * and the same tag excludes it from computeNsitf's base at the caller's
 * org-level aggregation. No rent relief either: relief is already fully
 * allocated across the employee's regular periods this year: applying it
 * again here would double-count it.
 */
export function deriveLumpSumPayslip(input: LumpSumPayslipInput, ruleVersion: RuleVersion): LumpSumPayslipResult {
  const periodComponents: PayComponent[] = [{ code: input.kind, amountKobo: input.amountKobo, kind: input.kind }];
  const grossKobo = input.amountKobo;
  const chargeableIncomeKobo = input.cumulativeChargeableIncomeBeforeKobo + grossKobo;
  const payeKobo = computeCumulativePeriodPaye(chargeableIncomeKobo, input.cumulativePayePaidBeforeKobo, ruleVersion);
  const netKobo = clampNonNegative(grossKobo - payeKobo);

  return { grossKobo, chargeableIncomeKobo, payeKobo, netKobo, periodComponents };
}
