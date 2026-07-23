"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1 } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { computeSettlementPreview } from "./compute";

export type ProcessSettlementState = { error?: string } | null;

export async function processFinalSettlement(
  employeeId: string,
  _prevState: ProcessSettlementState,
  _formData: FormData,
): Promise<ProcessSettlementState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .in("role", ["admin", "payroll_manager"]);

  if (!memberships || memberships.length === 0) {
    return { error: "You don't have permission to process a final settlement." };
  }

  // Recomputed here, server-side, from live data — never trusts anything
  // the browser posted back. This is the same figures the preview page
  // just showed, derived identically.
  const preview = await computeSettlementPreview(supabase, employeeId);
  if (!preview) {
    return { error: "Employee not found." };
  }
  if (!preview.eligible) {
    return { error: preview.blockedReason ?? "This employee isn't eligible for a final settlement." };
  }

  const today = new Date().toISOString().slice(0, 10);

  const postings = [
    { account_code: "leave_payout_expense", direction: "debit", amount_kobo: Number(preview.leavePayoutKobo) },
    { account_code: "gratuity_expense", direction: "debit", amount_kobo: Number(preview.gratuityKobo) },
    { account_code: "net_pay_payable", direction: "credit", amount_kobo: Number(preview.netSettlementKobo) },
    { account_code: "paye_payable", direction: "credit", amount_kobo: Number(preview.payeKobo) },
    { account_code: "staff_loans_receivable", direction: "credit", amount_kobo: Number(preview.loanClearanceKobo) },
  ].filter((posting) => posting.amount_kobo > 0);

  const { data: payRun, error: rpcError } = await supabase.rpc("create_pay_run", {
    payload: {
      org_id: preview.orgId,
      period_start: today,
      period_end: today,
      frequency: "off-cycle",
      rule_version_id: NG_2026_1.id,
      employee_count: 1,
      gross_kobo: Number(preview.grossSettlementKobo),
      net_kobo: Number(preview.netSettlementKobo),
      memo: `Final Settlement — ${preview.employeeName}`,
      payslips: [
        {
          employee_id: preview.employeeId,
          gross_kobo: Number(preview.grossSettlementKobo),
          pensionable_kobo: 0,
          pension_employee_kobo: 0,
          pension_employer_kobo: 0,
          nhf_kobo: 0,
          rent_relief_kobo: 0,
          chargeable_income_kobo: Number(preview.grossSettlementKobo),
          paye_kobo: Number(preview.payeKobo),
          employee_deductions_kobo: Number(preview.payeKobo) + Number(preview.loanClearanceKobo),
          net_kobo: Number(preview.netSettlementKobo),
          cumulative_chargeable_income_before_kobo: 0,
          cumulative_paye_paid_before_kobo: 0,
          postings,
        },
      ],
      loan_repayments: preview.activeLoans.map((loan) => ({
        loan_id: loan.id,
        employee_id: preview.employeeId,
        amount_kobo: Number(loan.outstandingKobo),
      })),
    },
  });

  if (rpcError || !payRun) {
    return { error: rpcError?.message ?? "Failed to process settlement." };
  }

  const { error: recordError } = await supabase.from("final_settlements").insert({
    org_id: preview.orgId,
    employee_id: preview.employeeId,
    pay_run_id: payRun.id,
    service_years: preview.serviceYears,
    leave_days_paid: preview.leaveDaysPaid,
    leave_payout_kobo: Number(preview.leavePayoutKobo),
    gratuity_kobo: Number(preview.gratuityKobo),
    loan_clearance_kobo: Number(preview.loanClearanceKobo),
    net_settlement_kobo: Number(preview.netSettlementKobo),
    processed_by: user.id,
  });

  if (recordError) {
    return {
      error: `Settlement was processed and paid (pay run ${payRun.id}), but the settlement record failed to save: ${recordError.message}`,
    };
  }

  revalidatePath("/employees");
  revalidatePath("/settlements");
  redirect("/settlements");
}
