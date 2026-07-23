import {
  NG_2026_1,
  clampNonNegative,
  computeCumulativePeriodPaye,
  computeNhf,
  computePension,
  type PayComponent,
} from "@plutus/compliance";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

// Gratuity is taxable per the Nigeria Tax Act 2025 (nigeria-statutory-
// compliance.md §1), so it flows through PAYE like any other remuneration.
// But there is no single legislated gratuity *rate* the way there is for
// PAYE bands or pension — severance formulas vary by employer policy and
// contract. This is a configurable company-policy default (1 month's pay
// per completed year of service), not a claimed statutory minimum.
export const GRATUITY_DAYS_PER_YEAR_OF_SERVICE = 30;

export interface SettlementPreview {
  employeeId: string;
  employeeName: string;
  orgId: string;
  eligible: boolean;
  blockedReason?: string;
  serviceYears: number;
  leaveDaysPaid: number;
  leavePayoutKobo: bigint;
  gratuityKobo: bigint;
  /** Regular basic/housing/transport for the partial final period between the employee's last regular pay run and their last working day — pensionable and NHF-able, unlike the leave/gratuity lump sum. */
  finalPeriodDaysWorked: number;
  finalPeriodGrossKobo: bigint;
  finalPeriodPensionableKobo: bigint;
  finalPeriodPensionEmployeeKobo: bigint;
  finalPeriodPensionEmployerKobo: bigint;
  finalPeriodNhfKobo: bigint;
  grossSettlementKobo: bigint;
  payeKobo: bigint;
  /** Cumulative year-to-date chargeable income as of (including) this settlement — persisted so a later payslip can carry it forward. */
  chargeableIncomeKobo: bigint;
  /** The employee's actual year-to-date position going into this settlement — carried from their most recent payslip, never zero for someone who was paid this year. */
  cumulativeChargeableIncomeBeforeKobo: bigint;
  cumulativePayePaidBeforeKobo: bigint;
  loanClearanceKobo: bigint;
  netSettlementKobo: bigint;
  activeLoans: { id: string; outstandingKobo: bigint }[];
}

export async function computeSettlementPreview(
  supabase: SupabaseClient<Database>,
  employeeId: string,
): Promise<SettlementPreview | null> {
  const { data: employee } = await supabase.from("employees").select("*").eq("id", employeeId).maybeSingle();
  if (!employee) return null;

  const base: Omit<
    SettlementPreview,
    | "eligible"
    | "blockedReason"
    | "serviceYears"
    | "leaveDaysPaid"
    | "leavePayoutKobo"
    | "gratuityKobo"
    | "finalPeriodDaysWorked"
    | "finalPeriodGrossKobo"
    | "finalPeriodPensionableKobo"
    | "finalPeriodPensionEmployeeKobo"
    | "finalPeriodPensionEmployerKobo"
    | "finalPeriodNhfKobo"
    | "grossSettlementKobo"
    | "payeKobo"
    | "chargeableIncomeKobo"
    | "cumulativeChargeableIncomeBeforeKobo"
    | "cumulativePayePaidBeforeKobo"
    | "loanClearanceKobo"
    | "netSettlementKobo"
    | "activeLoans"
  > = {
    employeeId: employee.id,
    employeeName: employee.full_name,
    orgId: employee.org_id,
  };

  if (employee.status !== "terminated") {
    return {
      ...base,
      eligible: false,
      blockedReason: "Employee must be marked Terminated (via the edit page) before a final settlement can be processed.",
      serviceYears: 0,
      leaveDaysPaid: 0,
      leavePayoutKobo: 0n,
      gratuityKobo: 0n,
      finalPeriodDaysWorked: 0,
      finalPeriodGrossKobo: 0n,
      finalPeriodPensionableKobo: 0n,
      finalPeriodPensionEmployeeKobo: 0n,
      finalPeriodPensionEmployerKobo: 0n,
      finalPeriodNhfKobo: 0n,
      grossSettlementKobo: 0n,
      payeKobo: 0n,
      chargeableIncomeKobo: 0n,
      cumulativeChargeableIncomeBeforeKobo: 0n,
      cumulativePayePaidBeforeKobo: 0n,
      loanClearanceKobo: 0n,
      netSettlementKobo: 0n,
      activeLoans: [],
    };
  }

  if (!employee.hire_date) {
    return {
      ...base,
      eligible: false,
      blockedReason: "Employee has no hire date on file — set one on the edit page before processing a settlement.",
      serviceYears: 0,
      leaveDaysPaid: 0,
      leavePayoutKobo: 0n,
      gratuityKobo: 0n,
      finalPeriodDaysWorked: 0,
      finalPeriodGrossKobo: 0n,
      finalPeriodPensionableKobo: 0n,
      finalPeriodPensionEmployeeKobo: 0n,
      finalPeriodPensionEmployerKobo: 0n,
      finalPeriodNhfKobo: 0n,
      grossSettlementKobo: 0n,
      payeKobo: 0n,
      chargeableIncomeKobo: 0n,
      cumulativeChargeableIncomeBeforeKobo: 0n,
      cumulativePayePaidBeforeKobo: 0n,
      loanClearanceKobo: 0n,
      netSettlementKobo: 0n,
      activeLoans: [],
    };
  }

  const { data: existingSettlement } = await supabase
    .from("final_settlements")
    .select("id")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (existingSettlement) {
    return {
      ...base,
      eligible: false,
      blockedReason: "A final settlement has already been processed for this employee.",
      serviceYears: 0,
      leaveDaysPaid: 0,
      leavePayoutKobo: 0n,
      gratuityKobo: 0n,
      finalPeriodDaysWorked: 0,
      finalPeriodGrossKobo: 0n,
      finalPeriodPensionableKobo: 0n,
      finalPeriodPensionEmployeeKobo: 0n,
      finalPeriodPensionEmployerKobo: 0n,
      finalPeriodNhfKobo: 0n,
      grossSettlementKobo: 0n,
      payeKobo: 0n,
      chargeableIncomeKobo: 0n,
      cumulativeChargeableIncomeBeforeKobo: 0n,
      cumulativePayePaidBeforeKobo: 0n,
      loanClearanceKobo: 0n,
      netSettlementKobo: 0n,
      activeLoans: [],
    };
  }

  const daysSinceHire = Math.floor((Date.now() - Date.parse(employee.hire_date)) / 86_400_000);
  const serviceYears = Math.floor(daysSinceHire / 365.25);

  const annualContractualKobo =
    BigInt(employee.basic_kobo) + BigInt(employee.housing_kobo) + BigInt(employee.transport_kobo);
  const dailyRateKobo = annualContractualKobo / 365n;

  const leaveDaysPaid = Number(employee.annual_leave_balance_days);
  const leavePayoutKobo = dailyRateKobo * BigInt(Math.max(0, Math.round(leaveDaysPaid)));

  const gratuityDays = serviceYears * GRATUITY_DAYS_PER_YEAR_OF_SERVICE;
  const gratuityKobo = dailyRateKobo * BigInt(gratuityDays);

  // Final period regular pay: the days between the employee's last regular
  // pay run and their last working day were otherwise never paid — this
  // used to be a silent gap (Final Settlement covered only leave payout and
  // gratuity). Unlike those two, which are non-pensionable lump sums, this
  // is ordinary earned pay, so it's pensionable and NHF-able like a normal
  // payslip. Last working day comes from the auto-logged
  // employee_status_history active→terminated transition (falls back to
  // today if none exists — e.g. an employee terminated before that
  // migration shipped — which slightly overpays rather than guessing at an
  // unrecorded date). Rent relief is deliberately not prorated for this
  // stub: correctly allocating it would require tracking how much relief
  // each prior period already consumed this year, which nothing in the
  // schema does today — a disclosed simplification, not a claimed figure.
  const { data: employeePayslips } = await supabase
    .from("payslips")
    .select("pay_run_id")
    .eq("employee_id", employeeId);
  const payRunIds = (employeePayslips ?? []).map((p) => p.pay_run_id);

  const { data: lastRegularPayRun } =
    payRunIds.length > 0
      ? await supabase
          .from("pay_runs")
          .select("period_end")
          .in("id", payRunIds)
          .in("frequency", ["weekly", "biweekly", "monthly"])
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const { data: terminationEvent } = await supabase
    .from("employee_status_history")
    .select("changed_at")
    .eq("employee_id", employeeId)
    .eq("new_status", "terminated")
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payThroughTime = lastRegularPayRun
    ? Date.parse(lastRegularPayRun.period_end)
    : Date.parse(employee.hire_date) - 86_400_000;
  const lastWorkingTime = terminationEvent ? Date.parse(terminationEvent.changed_at) : Date.now();
  const finalPeriodDaysWorked = Math.max(0, Math.round((lastWorkingTime - payThroughTime) / 86_400_000));

  const dailyBasicKobo = BigInt(employee.basic_kobo) / 365n;
  const dailyHousingKobo = BigInt(employee.housing_kobo) / 365n;
  const dailyTransportKobo = BigInt(employee.transport_kobo) / 365n;

  const finalPeriodComponents: PayComponent[] = [
    { code: "basic", amountKobo: dailyBasicKobo * BigInt(finalPeriodDaysWorked), kind: "regular" },
    { code: "housing", amountKobo: dailyHousingKobo * BigInt(finalPeriodDaysWorked), kind: "regular" },
    { code: "transport", amountKobo: dailyTransportKobo * BigInt(finalPeriodDaysWorked), kind: "regular" },
  ];
  const finalPeriodGrossKobo = finalPeriodComponents.reduce((sum, component) => sum + component.amountKobo, 0n);
  const finalPeriodPension = computePension(finalPeriodComponents, NG_2026_1);
  const finalPeriodNhfKobo = computeNhf(finalPeriodComponents, NG_2026_1);

  const grossSettlementKobo = finalPeriodGrossKobo + leavePayoutKobo + gratuityKobo;

  // Same cumulative carry-forward as a regular pay run — a settlement
  // isn't taxed as if it were the employee's only income of the year.
  const { data: recentPayslip } = await supabase
    .from("payslips")
    .select("chargeable_income_kobo, cumulative_paye_paid_before_kobo, paye_kobo")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cumulativeChargeableIncomeBeforeKobo = recentPayslip ? BigInt(recentPayslip.chargeable_income_kobo) : 0n;
  const cumulativePayePaidBeforeKobo = recentPayslip
    ? BigInt(recentPayslip.cumulative_paye_paid_before_kobo) + BigInt(recentPayslip.paye_kobo)
    : 0n;

  // Final period pay is taxable pensionable income, leave payout and
  // gratuity are taxable non-pensionable lump sums — all three are taxed
  // together in one cumulative-PAYE calculation off the same year-to-date
  // baseline (never as separate calls, which would each start from the same
  // "before" figure and miscompute which marginal band the combined total
  // actually lands in — feature-backlog.md §1's flagged proration/
  // cumulative-PAYE interaction).
  const finalPeriodChargeableAdditionKobo = clampNonNegative(
    finalPeriodGrossKobo - finalPeriodPension.employeeKobo - finalPeriodNhfKobo,
  );
  const chargeableIncomeKobo =
    cumulativeChargeableIncomeBeforeKobo + finalPeriodChargeableAdditionKobo + leavePayoutKobo + gratuityKobo;
  const payeKobo = computeCumulativePeriodPaye(chargeableIncomeKobo, cumulativePayePaidBeforeKobo, NG_2026_1);

  const { data: activeLoans } = await supabase
    .from("loans")
    .select("id, outstanding_kobo")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .gt("outstanding_kobo", 0);

  const loanClearanceKobo = (activeLoans ?? []).reduce((sum, loan) => sum + BigInt(loan.outstanding_kobo), 0n);
  const loansForRepayment = (activeLoans ?? []).map((loan) => ({
    id: loan.id,
    outstandingKobo: BigInt(loan.outstanding_kobo),
  }));

  const netSettlementKobo = clampNonNegative(
    grossSettlementKobo - finalPeriodPension.employeeKobo - finalPeriodNhfKobo - payeKobo - loanClearanceKobo,
  );

  return {
    ...base,
    eligible: true,
    serviceYears,
    leaveDaysPaid,
    leavePayoutKobo,
    gratuityKobo,
    finalPeriodDaysWorked,
    finalPeriodGrossKobo,
    finalPeriodPensionableKobo: finalPeriodPension.pensionableBaseKobo,
    finalPeriodPensionEmployeeKobo: finalPeriodPension.employeeKobo,
    finalPeriodPensionEmployerKobo: finalPeriodPension.employerKobo,
    finalPeriodNhfKobo,
    grossSettlementKobo,
    payeKobo,
    chargeableIncomeKobo,
    cumulativeChargeableIncomeBeforeKobo,
    cumulativePayePaidBeforeKobo,
    loanClearanceKobo,
    netSettlementKobo,
    activeLoans: loansForRepayment,
  };
}
