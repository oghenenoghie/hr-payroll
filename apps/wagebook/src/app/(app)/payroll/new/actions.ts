"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  NG_2026_1,
  checkTinGate,
  computeNsitf,
  derivePeriodPayslip,
  type PayComponent,
  type PayFrequency,
} from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";

export type CreatePayRunState = { error?: string; missingTin?: string[] } | null;

export async function createPayRun(_prevState: CreatePayRunState, formData: FormData): Promise<CreatePayRunState> {
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

  const membership = memberships?.[0];
  if (!membership) {
    return { error: "You don't have permission to run payroll." };
  }

  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  const frequency = String(formData.get("frequency") ?? "monthly") as PayFrequency;

  if (!periodStart || !periodEnd) {
    return { error: "Period start and end are required." };
  }

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", membership.org_id)
    .eq("status", "active");

  if (employeesError) {
    return { error: employeesError.message };
  }

  if (!employees || employees.length === 0) {
    return { error: "No active employees to run payroll for." };
  }

  // TIN gate: flag before the run, never process a TIN-less employee silently.
  const tinFailures = checkTinGate(employees.map((e) => ({ employeeId: e.id, tin: e.tin })));
  if (tinFailures.length > 0) {
    const missingNames = employees
      .filter((e) => tinFailures.some((f) => f.employeeId === e.id))
      .map((e) => e.full_name);
    return {
      error: "Some employees are missing a TIN. The run is blocked until every employee has one.",
      missingTin: missingNames,
    };
  }

  // Carry forward cumulative PAYE state from each employee's most recent
  // payslip — never restart cumulative income at zero for an employee
  // who's already had pay runs this year.
  const { data: recentPayslips } = await supabase
    .from("payslips")
    .select("employee_id, chargeable_income_kobo, cumulative_paye_paid_before_kobo, paye_kobo, created_at")
    .in(
      "employee_id",
      employees.map((e) => e.id),
    )
    .order("created_at", { ascending: false });

  const priorStateByEmployee = new Map<string, { chargeableIncomeKobo: bigint; payePaidAfterKobo: bigint }>();
  for (const slip of recentPayslips ?? []) {
    if (priorStateByEmployee.has(slip.employee_id)) continue; // already have the most recent one
    priorStateByEmployee.set(slip.employee_id, {
      chargeableIncomeKobo: BigInt(slip.chargeable_income_kobo),
      payePaidAfterKobo: BigInt(slip.cumulative_paye_paid_before_kobo) + BigInt(slip.paye_kobo),
    });
  }

  // Approved loans with a remaining balance are deducted from net pay every
  // run — oldest first — never a pre-tax relief, just a post-tax deduction
  // layered on top of what the compliance engine already computed.
  const { data: activeLoans } = await supabase
    .from("loans")
    .select("id, employee_id, monthly_repayment_kobo, outstanding_kobo")
    .eq("org_id", membership.org_id)
    .eq("status", "approved")
    .gt("outstanding_kobo", 0)
    .order("created_at", { ascending: true });

  const loansByEmployee = new Map<string, NonNullable<typeof activeLoans>>();
  for (const loan of activeLoans ?? []) {
    const list = loansByEmployee.get(loan.employee_id) ?? [];
    list.push(loan);
    loansByEmployee.set(loan.employee_id, list);
  }

  let totalGrossKobo = 0n;
  let totalNetKobo = 0n;
  const allPeriodComponents: PayComponent[][] = [];
  const loanRepaymentsPayload: { loan_id: string; employee_id: string; amount_kobo: number }[] = [];

  const payslipsPayload = employees.map((employee) => {
    const prior = priorStateByEmployee.get(employee.id);
    const annualPayComponents: PayComponent[] = [
      { code: "basic", amountKobo: BigInt(employee.basic_kobo), kind: "regular" },
      { code: "housing", amountKobo: BigInt(employee.housing_kobo), kind: "regular" },
      { code: "transport", amountKobo: BigInt(employee.transport_kobo), kind: "regular" },
    ];

    const result = derivePeriodPayslip(
      {
        annualPayComponents,
        annualRentPaidKobo: BigInt(employee.annual_rent_kobo),
        frequency,
        cumulativeChargeableIncomeBeforeKobo: prior?.chargeableIncomeKobo ?? 0n,
        cumulativePayePaidBeforeKobo: prior?.payePaidAfterKobo ?? 0n,
      },
      NG_2026_1,
    );

    allPeriodComponents.push(result.periodComponents);

    // Apply loan repayments on top of the compliance engine's result —
    // post-tax deductions, never touching chargeable income or PAYE.
    // Oldest loan first; each capped at its own outstanding balance and at
    // whatever net pay remains, so a loan can never push net pay negative.
    let loanDeductionKobo = 0n;
    for (const loan of loansByEmployee.get(employee.id) ?? []) {
      const remainingNet = result.netKobo - loanDeductionKobo;
      if (remainingNet <= 0n) break;
      const repaymentKobo = [BigInt(loan.monthly_repayment_kobo), BigInt(loan.outstanding_kobo), remainingNet].reduce(
        (a, b) => (a < b ? a : b),
      );
      if (repaymentKobo <= 0n) continue;
      loanDeductionKobo += repaymentKobo;
      loanRepaymentsPayload.push({ loan_id: loan.id, employee_id: employee.id, amount_kobo: Number(repaymentKobo) });
    }

    const netKobo = result.netKobo - loanDeductionKobo;
    const employeeDeductionsKobo = result.employeeDeductionsKobo + loanDeductionKobo;
    totalGrossKobo += result.grossKobo;
    totalNetKobo += netKobo;

    // Employer costs (pension employer share) are tracked on their own
    // ledger line — never folded into an employee-facing deduction total.
    const postings = [
      { account_code: "payroll_expense", direction: "debit", amount_kobo: result.grossKobo },
      { account_code: "employer_pension_expense", direction: "debit", amount_kobo: result.pensionEmployerKobo },
      { account_code: "net_pay_payable", direction: "credit", amount_kobo: netKobo },
      { account_code: "paye_payable", direction: "credit", amount_kobo: result.payeKobo },
      {
        account_code: "pension_payable",
        direction: "credit",
        amount_kobo: result.pensionEmployeeKobo + result.pensionEmployerKobo,
      },
      { account_code: "nhf_payable", direction: "credit", amount_kobo: result.nhfKobo },
      { account_code: "staff_loans_receivable", direction: "credit", amount_kobo: loanDeductionKobo },
    ].filter((posting) => posting.amount_kobo > 0n);

    return {
      employee_id: employee.id,
      gross_kobo: Number(result.grossKobo),
      pensionable_kobo: Number(result.pensionableKobo),
      pension_employee_kobo: Number(result.pensionEmployeeKobo),
      pension_employer_kobo: Number(result.pensionEmployerKobo),
      nhf_kobo: Number(result.nhfKobo),
      rent_relief_kobo: Number(result.rentReliefKobo),
      chargeable_income_kobo: Number(result.chargeableIncomeKobo),
      paye_kobo: Number(result.payeKobo),
      employee_deductions_kobo: Number(employeeDeductionsKobo),
      net_kobo: Number(netKobo),
      cumulative_chargeable_income_before_kobo: Number(prior?.chargeableIncomeKobo ?? 0n),
      cumulative_paye_paid_before_kobo: Number(prior?.payePaidAfterKobo ?? 0n),
      postings: postings.map((posting) => ({ ...posting, amount_kobo: Number(posting.amount_kobo) })),
    };
  });

  // NSITF is computed on the whole run's total payroll base, not per
  // employee — an org-level cost, never an employee deduction.
  const nsitf = computeNsitf(allPeriodComponents, NG_2026_1);
  const orgPostings = [
    { account_code: "nsitf_expense", direction: "debit", amount_kobo: nsitf.employerKobo },
    { account_code: "nsitf_payable", direction: "credit", amount_kobo: nsitf.employerKobo },
  ].filter((posting) => posting.amount_kobo > 0n);

  const { error: rpcError } = await supabase.rpc("create_pay_run", {
    payload: {
      org_id: membership.org_id,
      period_start: periodStart,
      period_end: periodEnd,
      frequency,
      rule_version_id: NG_2026_1.id,
      employee_count: employees.length,
      gross_kobo: Number(totalGrossKobo),
      net_kobo: Number(totalNetKobo),
      memo: `Payroll ${periodStart} – ${periodEnd}`,
      payslips: payslipsPayload,
      org_postings: orgPostings.map((posting) => ({ ...posting, amount_kobo: Number(posting.amount_kobo) })),
      loan_repayments: loanRepaymentsPayload,
    },
  });

  if (rpcError) {
    return { error: rpcError.message };
  }

  revalidatePath("/payroll");
  revalidatePath("/loans");
  redirect("/payroll");
}
