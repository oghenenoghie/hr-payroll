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

export type LumpSumKind = "bonus" | "thirteenth_month" | "one_off" | "arrears";

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
 * Derives a standalone lump-sum payslip — bonus, 13th month, arrears, or a
 * final settlement's combined leave-encashment + gratuity payout (kind
 * "one_off") — added whole to this period (no proration by frequency,
 * unlike derivePeriodPayslip), taxed via the same cumulative-PAYE
 * mechanism so it correctly pushes the employee's year-to-date position
 * into a higher marginal band when it's large enough to (feature-
 * backlog.md §1's specifically-flagged case, called out separately for
 * both the 13th-month scenario and "termination payments: gratuity is
 * taxable under the new Act").
 *
 * Arrears ("kind: arrears") is retroactive pay — a shortfall from a prior
 * period being paid out now (a late-processed raise, a corrected payroll
 * error). feature-backlog.md §1 flagged an open statutory question here:
 * whether arrears should be taxed under the rules in force when *earned*
 * or when *paid*. Resolved (by product decision, not yet confirmed
 * against a Nigerian tax professional) as period of receipt — arrears is
 * taxed under whichever RuleVersion is passed in here, same as every
 * other lump sum, rather than reaching back to a historical rule version
 * for the period the pay related to. That period/reason is instead
 * recorded as a free-text note on the payslip (see arrears_note in the
 * pay-run migration) — audit context, not a second tax calculation.
 *
 * Deliberately not pensionable and outside the NHF base: the component is
 * tagged with `kind` (never "regular") and coded to match, so
 * computePension (basic/housing/transport only) and computeNhf (basic
 * only) naturally compute zero against it without a special case here —
 * and the same tag excludes it from computeNsitf's base at the caller's
 * org-level aggregation. No rent relief either: relief is already fully
 * allocated across the employee's regular periods this year: applying it
 * again here would double-count it. For arrears this is itself a
 * disclosed simplification: if the shortfall being repaid was itself
 * pensionable/NHF-able regular pay (e.g. a retroactive basic-salary
 * raise), the statutorily precise treatment would restate those prior
 * periods' pension/NHF too — not attempted here.
 */
export function deriveLumpSumPayslip(input: LumpSumPayslipInput, ruleVersion: RuleVersion): LumpSumPayslipResult {
  const periodComponents: PayComponent[] = [{ code: input.kind, amountKobo: input.amountKobo, kind: input.kind }];
  const grossKobo = input.amountKobo;
  const chargeableIncomeKobo = input.cumulativeChargeableIncomeBeforeKobo + grossKobo;
  const payeKobo = computeCumulativePeriodPaye(chargeableIncomeKobo, input.cumulativePayePaidBeforeKobo, ruleVersion);
  const netKobo = clampNonNegative(grossKobo - payeKobo);

  return { grossKobo, chargeableIncomeKobo, payeKobo, netKobo, periodComponents };
}

const GROSS_UP_MAX_ITERATIONS = 128;
const REGULAR_GROSS_UP_MAX_ITERATIONS = 128;

/**
 * Solves for the lump-sum gross that nets to targetNetKobo after cumulative
 * PAYE, given the employee's existing year-to-date position — net-to-gross
 * (feature-backlog.md §1: "common in Nigerian senior and expatriate
 * contracts where the employer bears the tax," requiring "an iterative
 * solve... with an explicit tolerance and iteration cap").
 *
 * Net-of-PAYE is monotonically non-decreasing in gross: every PAYE band's
 * marginal rate is below 100% (the top band here is 25%), so each extra
 * kobo of gross always yields at least some extra kobo of net, and
 * rounding (applyRate rounds to nearest) can only ever round a
 * non-decreasing input up or down consistently — never make a larger
 * gross produce a smaller net. That guarantees bisection converges to the
 * *exact* minimal gross whose net is >= target, in a bounded number of
 * iterations, with no false convergence. Scoped to lump sums only (not an
 * employee's regular annual package — see deriveGrossedUpLumpSumPayslip).
 */
export function solveLumpSumGrossForNetKobo(
  targetNetKobo: Kobo,
  cumulativeChargeableIncomeBeforeKobo: Kobo,
  cumulativePayePaidBeforeKobo: Kobo,
  ruleVersion: RuleVersion,
): { grossKobo: Kobo; iterations: number } {
  if (targetNetKobo <= 0n) {
    return { grossKobo: 0n, iterations: 0 };
  }

  const netForGross = (candidateGrossKobo: Kobo): Kobo => {
    const chargeableIncomeKobo = cumulativeChargeableIncomeBeforeKobo + candidateGrossKobo;
    const payeKobo = computeCumulativePeriodPaye(chargeableIncomeKobo, cumulativePayePaidBeforeKobo, ruleVersion);
    return clampNonNegative(candidateGrossKobo - payeKobo);
  };

  let iterations = 0;

  // Net can never exceed gross (payeKobo is never negative), so gross =
  // targetNet is always a valid starting ceiling; double until it's
  // actually sufficient (bounded by the iteration cap, never unbounded).
  let low = targetNetKobo;
  let high = targetNetKobo;
  while (netForGross(high) < targetNetKobo && iterations < GROSS_UP_MAX_ITERATIONS) {
    high *= 2n;
    iterations++;
  }

  while (high - low > 1n && iterations < GROSS_UP_MAX_ITERATIONS) {
    const mid = low + (high - low) / 2n;
    if (netForGross(mid) >= targetNetKobo) {
      high = mid;
    } else {
      low = mid;
    }
    iterations++;
  }

  return { grossKobo: high, iterations };
}

export interface GrossedUpLumpSumInput {
  kind: LumpSumKind;
  /** The amount the employee should actually receive — the employer bears the PAYE on top of this. */
  targetNetKobo: Kobo;
  cumulativeChargeableIncomeBeforeKobo: Kobo;
  cumulativePayePaidBeforeKobo: Kobo;
}

/**
 * Gross-up variant of deriveLumpSumPayslip: solves for the gross that
 * produces the requested net via solveLumpSumGrossForNetKobo, then derives
 * the payslip normally from that solved gross — so the result carries the
 * exact same shape, and the exact same non-pensionable/non-NHF/non-NSITF
 * treatment, as every other lump sum. Because the solve finds the minimal
 * gross whose net is *at least* the target, netKobo on the result may land
 * a few kobo above targetNetKobo (kobo-granularity rounding), never below.
 */
export function deriveGrossedUpLumpSumPayslip(
  input: GrossedUpLumpSumInput,
  ruleVersion: RuleVersion,
): LumpSumPayslipResult & { iterations: number } {
  const { grossKobo, iterations } = solveLumpSumGrossForNetKobo(
    input.targetNetKobo,
    input.cumulativeChargeableIncomeBeforeKobo,
    input.cumulativePayePaidBeforeKobo,
    ruleVersion,
  );

  const result = deriveLumpSumPayslip(
    {
      kind: input.kind,
      amountKobo: grossKobo,
      cumulativeChargeableIncomeBeforeKobo: input.cumulativeChargeableIncomeBeforeKobo,
      cumulativePayePaidBeforeKobo: input.cumulativePayePaidBeforeKobo,
    },
    ruleVersion,
  );

  return { ...result, iterations };
}

export interface RegularPackageGrossUpInput {
  /**
   * The employee's current basic/housing/transport package. Only the
   * *ratio* between these amounts is used — magnitudes are rescaled
   * together during the solve — so an employee whose package is split
   * 60% basic / 30% housing / 10% transport today keeps that same split
   * after grossing up, just scaled to a larger total.
   */
  currentAnnualPayComponents: PayComponent[];
  annualRentPaidKobo: Kobo;
  frequency: PayFrequency;
  /** The take-home this employee should receive for one period at `frequency` — the employer bears the tax on top of it. */
  targetPeriodNetKobo: Kobo;
  cumulativeChargeableIncomeBeforeKobo: Kobo;
  cumulativePayePaidBeforeKobo: Kobo;
}

export interface RegularPackageGrossUpResult {
  /** The solved annual basic/housing/transport package, same component codes and ratio as the input. */
  annualPayComponents: PayComponent[];
  /** The period payslip derived from the solved package. */
  periodPayslip: PeriodPayslipResult;
  iterations: number;
}

/**
 * Rescales `components` so their total becomes `targetTotalKobo`, preserving
 * each component's share of the original total. Integer division truncates
 * per component (a few kobo of the total can go unallocated across a large
 * component count) — consistent with this package's stated per-period
 * rounding convention (see proratePerPeriod) rather than a new one.
 */
function scaleComponentsToTotal(components: PayComponent[], originalTotalKobo: Kobo, targetTotalKobo: Kobo): PayComponent[] {
  return components.map((component) => ({
    ...component,
    amountKobo: (component.amountKobo * targetTotalKobo) / originalTotalKobo,
  }));
}

/**
 * Solves for the annual basic/housing/transport package (in the employee's
 * existing proportions) whose derived period payslip nets to at least
 * targetPeriodNetKobo — gross-up for an employee's *regular* package, as
 * opposed to solveLumpSumGrossForNetKobo's one-off payment.
 *
 * feature-backlog.md §1 left this open specifically because "it's unclear
 * which component should absorb the increase and how pension/NHF/rent
 * relief should interact with an unknown gross before it's solved." This
 * resolves it with a disclosed simplification, the same way the arrears
 * rule-version question was resolved: by an explicit, recorded product
 * decision rather than a silent guess, still open to being revisited
 * against a Nigerian tax professional or payroll-practice convention.
 *
 * The decision: **distribute the increase proportionally across all three
 * components**, preserving today's basic:housing:transport ratio, rather
 * than concentrating it entirely in one component (e.g. basic). This was
 * chosen over concentrating in basic because piling a large raise onto
 * basic alone would inflate the pension and NHF bases (both driven off
 * basic) far more than a real negotiated package revision typically would,
 * and over concentrating in a non-pensionable/non-NHF component (e.g.
 * transport alone) because that would let a "gross-up" quietly shrink an
 * employee's pension contribution base — the proportional split changes
 * pension/NHF exposure by the least relative to the employee's existing
 * package shape.
 *
 * Rent relief doesn't affect which component should absorb the increase:
 * it's a function of annualRentPaidKobo alone, not of the package's
 * internal composition, so it's identical for every candidate split.
 *
 * Monotonicity (the same argument solveLumpSumGrossForNetKobo relies on):
 * scaling every component up by the same factor never decreases gross,
 * the pensionable base, or the NHF base, and net-of-(pension + NHF + PAYE)
 * is non-decreasing in gross because every marginal rate in the system
 * (8% employee pension + 2.5% NHF + up to 25% top PAYE band, per
 * NG_2026_1) sums to well under 100%. Bisection therefore converges to
 * the exact minimal annual total whose period net is >= target, in a
 * bounded number of iterations, with no false convergence.
 */
export function solveRegularPackageGrossUp(
  input: RegularPackageGrossUpInput,
  ruleVersion: RuleVersion,
): RegularPackageGrossUpResult {
  const originalTotalKobo = sumKobo(input.currentAnnualPayComponents.map((c) => c.amountKobo));

  if (originalTotalKobo <= 0n) {
    throw new Error(
      "Cannot gross up a regular package with a zero or negative total: the basic/housing/transport ratio is undefined.",
    );
  }

  const periodNetForAnnualTotal = (candidateAnnualTotalKobo: Kobo): Kobo =>
    derivePeriodPayslip(
      {
        annualPayComponents: scaleComponentsToTotal(input.currentAnnualPayComponents, originalTotalKobo, candidateAnnualTotalKobo),
        annualRentPaidKobo: input.annualRentPaidKobo,
        frequency: input.frequency,
        cumulativeChargeableIncomeBeforeKobo: input.cumulativeChargeableIncomeBeforeKobo,
        cumulativePayePaidBeforeKobo: input.cumulativePayePaidBeforeKobo,
      },
      ruleVersion,
    ).netKobo;

  const periodsPerYear = PERIODS_PER_YEAR[input.frequency];

  if (input.targetPeriodNetKobo <= 0n) {
    const periodPayslip = derivePeriodPayslip(
      {
        annualPayComponents: scaleComponentsToTotal(input.currentAnnualPayComponents, originalTotalKobo, 0n),
        annualRentPaidKobo: input.annualRentPaidKobo,
        frequency: input.frequency,
        cumulativeChargeableIncomeBeforeKobo: input.cumulativeChargeableIncomeBeforeKobo,
        cumulativePayePaidBeforeKobo: input.cumulativePayePaidBeforeKobo,
      },
      ruleVersion,
    );
    return {
      annualPayComponents: scaleComponentsToTotal(input.currentAnnualPayComponents, originalTotalKobo, 0n),
      periodPayslip,
      iterations: 0,
    };
  }

  let iterations = 0;

  // Period net can never exceed period gross, and period gross is the
  // annual total divided by periodsPerYear, so an annual total of
  // targetPeriodNetKobo * periodsPerYear is always a valid starting
  // ceiling; double until it's actually sufficient.
  let low = input.targetPeriodNetKobo * periodsPerYear;
  let high = low;
  while (periodNetForAnnualTotal(high) < input.targetPeriodNetKobo && iterations < REGULAR_GROSS_UP_MAX_ITERATIONS) {
    high *= 2n;
    iterations++;
  }

  while (high - low > 1n && iterations < REGULAR_GROSS_UP_MAX_ITERATIONS) {
    const mid = low + (high - low) / 2n;
    if (periodNetForAnnualTotal(mid) >= input.targetPeriodNetKobo) {
      high = mid;
    } else {
      low = mid;
    }
    iterations++;
  }

  const annualPayComponents = scaleComponentsToTotal(input.currentAnnualPayComponents, originalTotalKobo, high);
  const periodPayslip = derivePeriodPayslip(
    {
      annualPayComponents,
      annualRentPaidKobo: input.annualRentPaidKobo,
      frequency: input.frequency,
      cumulativeChargeableIncomeBeforeKobo: input.cumulativeChargeableIncomeBeforeKobo,
      cumulativePayePaidBeforeKobo: input.cumulativePayePaidBeforeKobo,
    },
    ruleVersion,
  );

  return { annualPayComponents, periodPayslip, iterations };
}
