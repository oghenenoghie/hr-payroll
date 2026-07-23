import { NG_2026_1, clampNonNegative, computeCumulativePeriodPaye } from "@plutus/compliance";
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
  grossSettlementKobo: bigint;
  payeKobo: bigint;
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
    | "grossSettlementKobo"
    | "payeKobo"
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
      grossSettlementKobo: 0n,
      payeKobo: 0n,
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
      grossSettlementKobo: 0n,
      payeKobo: 0n,
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
      grossSettlementKobo: 0n,
      payeKobo: 0n,
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

  const grossSettlementKobo = leavePayoutKobo + gratuityKobo;

  // Same cumulative carry-forward as a regular pay run — a settlement
  // isn't taxed as if it were the employee's only income of the year.
  const { data: recentPayslip } = await supabase
    .from("payslips")
    .select("cumulative_paye_paid_before_kobo, paye_kobo")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payePaidBeforeKobo = recentPayslip
    ? BigInt(recentPayslip.cumulative_paye_paid_before_kobo) + BigInt(recentPayslip.paye_kobo)
    : 0n;

  const payeKobo = computeCumulativePeriodPaye(grossSettlementKobo, payePaidBeforeKobo, NG_2026_1);

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

  const netSettlementKobo = clampNonNegative(grossSettlementKobo - payeKobo - loanClearanceKobo);

  return {
    ...base,
    eligible: true,
    serviceYears,
    leaveDaysPaid,
    leavePayoutKobo,
    gratuityKobo,
    grossSettlementKobo,
    payeKobo,
    loanClearanceKobo,
    netSettlementKobo,
    activeLoans: loansForRepayment,
  };
}
