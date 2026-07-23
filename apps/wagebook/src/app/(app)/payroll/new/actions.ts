"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  NG_2026_1,
  checkTinGate,
  clampNonNegative,
  computeCumulativePeriodPaye,
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

  // Approved-but-unpaid expense claims are reimbursed this run. Taxable
  // claims add to chargeable income and get re-taxed through the normal
  // progressive bands; non-taxable claims are pure pass-through cash.
  // Neither touches pension or NHF base — reimbursements aren't pensionable.
  const { data: unpaidExpenses } = await supabase
    .from("expenses")
    .select("id, employee_id, amount_kobo, taxable")
    .eq("org_id", membership.org_id)
    .eq("status", "approved");

  const expensesByEmployee = new Map<string, NonNullable<typeof unpaidExpenses>>();
  for (const expense of unpaidExpenses ?? []) {
    const list = expensesByEmployee.get(expense.employee_id) ?? [];
    list.push(expense);
    expensesByEmployee.set(expense.employee_id, list);
  }

  // Approved unpaid-leave requests are deducted this run too — those days
  // genuinely weren't earned, so the deduction reduces gross itself (and
  // chargeable income with it), not a post-tax line like a loan repayment.
  // Daily rate is annual contractual pay ÷ 365 calendar days — a disclosed
  // simplification, not a claimed statutory formula.
  const { data: approvedUnpaidLeave } = await supabase
    .from("leave_requests")
    .select("id, employee_id, days")
    .eq("org_id", membership.org_id)
    .eq("status", "approved")
    .eq("leave_type", "unpaid");

  const unpaidLeaveByEmployee = new Map<string, NonNullable<typeof approvedUnpaidLeave>>();
  for (const leave of approvedUnpaidLeave ?? []) {
    const list = unpaidLeaveByEmployee.get(leave.employee_id) ?? [];
    list.push(leave);
    unpaidLeaveByEmployee.set(leave.employee_id, list);
  }

  // Active benefit enrollments apply every run, automatically, for as long
  // as they stay active — no claim to approve, no balance to pay down.
  // Employer cost is a company cost (like NSITF or the pension employer
  // share); employee cost is a post-tax deduction (like a loan repayment).
  const { data: activeEnrollments } = await supabase
    .from("employee_benefit_enrollments")
    .select("employee_id, benefit_plans(employer_cost_kobo, employee_cost_kobo)")
    .eq("org_id", membership.org_id)
    .eq("status", "active");

  const enrollmentsByEmployee = new Map<string, NonNullable<typeof activeEnrollments>>();
  for (const enrollment of activeEnrollments ?? []) {
    const list = enrollmentsByEmployee.get(enrollment.employee_id) ?? [];
    list.push(enrollment);
    enrollmentsByEmployee.set(enrollment.employee_id, list);
  }

  let totalGrossKobo = 0n;
  let totalNetKobo = 0n;
  const allPeriodComponents: PayComponent[][] = [];
  const loanRepaymentsPayload: { loan_id: string; employee_id: string; amount_kobo: number }[] = [];
  const expenseReimbursementsPayload: { expense_id: string; employee_id: string }[] = [];
  const leaveDeductionsPayload: { leave_request_id: string; employee_id: string }[] = [];

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

    // Approved expense claims are reimbursed this run. Taxable claims add
    // straight to chargeable income and get re-taxed through the normal
    // cumulative bands; non-taxable claims are pure cash on top of gross.
    let taxableReimbursementKobo = 0n;
    let nonTaxableReimbursementKobo = 0n;
    for (const expense of expensesByEmployee.get(employee.id) ?? []) {
      if (expense.taxable) {
        taxableReimbursementKobo += BigInt(expense.amount_kobo);
      } else {
        nonTaxableReimbursementKobo += BigInt(expense.amount_kobo);
      }
      expenseReimbursementsPayload.push({ expense_id: expense.id, employee_id: employee.id });
    }
    const reimbursementKobo = taxableReimbursementKobo + nonTaxableReimbursementKobo;

    // Unpaid leave reduces gross (and, via chargeable income, PAYE) — the
    // employee simply wasn't paid for those days. Capped at this period's
    // annual-basis daily rate × days; never lets gross go negative.
    let unpaidLeaveDeductionKobo = 0n;
    const annualContractualKobo = BigInt(employee.basic_kobo) + BigInt(employee.housing_kobo) + BigInt(employee.transport_kobo);
    const dailyRateKobo = annualContractualKobo / 365n;
    for (const leave of unpaidLeaveByEmployee.get(employee.id) ?? []) {
      unpaidLeaveDeductionKobo += dailyRateKobo * BigInt(leave.days);
      leaveDeductionsPayload.push({ leave_request_id: leave.id, employee_id: employee.id });
    }

    const chargeableIncomeKobo = clampNonNegative(
      result.chargeableIncomeKobo + taxableReimbursementKobo - unpaidLeaveDeductionKobo,
    );
    const payeKobo =
      taxableReimbursementKobo > 0n || unpaidLeaveDeductionKobo > 0n
        ? computeCumulativePeriodPaye(chargeableIncomeKobo, prior?.payePaidAfterKobo ?? 0n, NG_2026_1)
        : result.payeKobo;
    const grossKobo = clampNonNegative(result.grossKobo + reimbursementKobo - unpaidLeaveDeductionKobo);
    const netBeforeLoanKobo = clampNonNegative(grossKobo - result.pensionEmployeeKobo - result.nhfKobo - payeKobo);

    // Apply loan repayments on top — post-tax deductions, never touching
    // chargeable income or PAYE. Oldest loan first; each capped at its own
    // outstanding balance and at whatever net pay remains, so a loan can
    // never push net pay negative.
    let loanDeductionKobo = 0n;
    for (const loan of loansByEmployee.get(employee.id) ?? []) {
      const remainingNet = netBeforeLoanKobo - loanDeductionKobo;
      if (remainingNet <= 0n) break;
      const repaymentKobo = [BigInt(loan.monthly_repayment_kobo), BigInt(loan.outstanding_kobo), remainingNet].reduce(
        (a, b) => (a < b ? a : b),
      );
      if (repaymentKobo <= 0n) continue;
      loanDeductionKobo += repaymentKobo;
      loanRepaymentsPayload.push({ loan_id: loan.id, employee_id: employee.id, amount_kobo: Number(repaymentKobo) });
    }

    // Active benefit enrollments apply every run: employer cost is a
    // company cost (like the pension employer share), employee cost is a
    // post-tax deduction (like a loan repayment) — neither touches
    // chargeable income or PAYE, since a benefit contribution isn't pay.
    let benefitEmployerCostKobo = 0n;
    let benefitEmployeeDeductionKobo = 0n;
    for (const enrollment of enrollmentsByEmployee.get(employee.id) ?? []) {
      benefitEmployerCostKobo += BigInt(enrollment.benefit_plans?.employer_cost_kobo ?? 0);
      benefitEmployeeDeductionKobo += BigInt(enrollment.benefit_plans?.employee_cost_kobo ?? 0);
    }

    const netKobo = netBeforeLoanKobo - loanDeductionKobo - benefitEmployeeDeductionKobo;
    const employeeDeductionsKobo =
      result.pensionEmployeeKobo + result.nhfKobo + payeKobo + loanDeductionKobo + benefitEmployeeDeductionKobo;
    totalGrossKobo += grossKobo;
    totalNetKobo += netKobo;

    // Employer costs (pension employer share, benefits) are tracked on
    // their own ledger lines — never folded into an employee-facing
    // deduction total. payroll_expense is reduced by the unpaid-leave
    // amount directly (the expense was never incurred), which is what
    // keeps this posting set balanced without a separate contra-account
    // line.
    const postings = [
      {
        account_code: "payroll_expense",
        direction: "debit",
        amount_kobo: clampNonNegative(result.grossKobo - unpaidLeaveDeductionKobo),
      },
      { account_code: "expense_reimbursement_expense", direction: "debit", amount_kobo: reimbursementKobo },
      { account_code: "employer_pension_expense", direction: "debit", amount_kobo: result.pensionEmployerKobo },
      { account_code: "benefits_expense", direction: "debit", amount_kobo: benefitEmployerCostKobo },
      { account_code: "net_pay_payable", direction: "credit", amount_kobo: netKobo },
      { account_code: "paye_payable", direction: "credit", amount_kobo: payeKobo },
      {
        account_code: "pension_payable",
        direction: "credit",
        amount_kobo: result.pensionEmployeeKobo + result.pensionEmployerKobo,
      },
      { account_code: "nhf_payable", direction: "credit", amount_kobo: result.nhfKobo },
      { account_code: "staff_loans_receivable", direction: "credit", amount_kobo: loanDeductionKobo },
      {
        account_code: "benefits_payable",
        direction: "credit",
        amount_kobo: benefitEmployerCostKobo + benefitEmployeeDeductionKobo,
      },
    ].filter((posting) => posting.amount_kobo > 0n);

    return {
      employee_id: employee.id,
      gross_kobo: Number(grossKobo),
      pensionable_kobo: Number(result.pensionableKobo),
      pension_employee_kobo: Number(result.pensionEmployeeKobo),
      pension_employer_kobo: Number(result.pensionEmployerKobo),
      nhf_kobo: Number(result.nhfKobo),
      rent_relief_kobo: Number(result.rentReliefKobo),
      chargeable_income_kobo: Number(chargeableIncomeKobo),
      paye_kobo: Number(payeKobo),
      employee_deductions_kobo: Number(employeeDeductionsKobo),
      net_kobo: Number(netKobo),
      cumulative_chargeable_income_before_kobo: Number(prior?.chargeableIncomeKobo ?? 0n),
      cumulative_paye_paid_before_kobo: Number(prior?.payePaidAfterKobo ?? 0n),
      taxable_reimbursement_kobo: Number(taxableReimbursementKobo),
      non_taxable_reimbursement_kobo: Number(nonTaxableReimbursementKobo),
      unpaid_leave_deduction_kobo: Number(unpaidLeaveDeductionKobo),
      benefit_employer_cost_kobo: Number(benefitEmployerCostKobo),
      benefit_employee_deduction_kobo: Number(benefitEmployeeDeductionKobo),
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
      expense_reimbursements: expenseReimbursementsPayload,
      leave_deductions: leaveDeductionsPayload,
    },
  });

  if (rpcError) {
    return { error: rpcError.message };
  }

  revalidatePath("/payroll");
  revalidatePath("/loans");
  revalidatePath("/expenses");
  revalidatePath("/leave");
  revalidatePath("/benefits");
  redirect("/payroll");
}
