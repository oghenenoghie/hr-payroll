"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  NG_2026_1,
  checkTinGate,
  clampNonNegative,
  computeCumulativePeriodPaye,
  computeNsitf,
  deriveLumpSumPayslip,
  derivePeriodPayslip,
  type PayComponent,
  type PayFrequency,
} from "@plutus/compliance";
import type { Json } from "@plutus/core";
import { createClient } from "@/lib/supabase/server";
import { getOrgRoleUserIds, notifyUsers } from "@/lib/notifications";

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
  const frequency = String(formData.get("frequency") ?? "monthly");

  if (!periodStart || !periodEnd) {
    return { error: "Period start and end are required." };
  }

  const { data: activeEmployees, error: employeesError } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", membership.org_id)
    .eq("status", "active");

  if (employeesError) {
    return { error: employeesError.message };
  }

  if (!activeEmployees || activeEmployees.length === 0) {
    return { error: "No active employees to run payroll for." };
  }

  // Bonus is discretionary and per-employee — unlike every other frequency,
  // which pays whoever is active automatically, only employees with a
  // nonzero entered amount are processed (and TIN-gated) at all.
  let employees = activeEmployees;
  const bonusAmountByEmployee = new Map<string, bigint>();
  if (frequency === "bonus") {
    for (const employee of activeEmployees) {
      const raw = formData.get(`bonus_amount_${employee.id}`);
      if (raw === null) continue;
      const amountNaira = Number(raw);
      if (!Number.isFinite(amountNaira) || amountNaira <= 0) continue;
      bonusAmountByEmployee.set(employee.id, BigInt(Math.round(amountNaira * 100)));
    }
    employees = activeEmployees.filter((employee) => bonusAmountByEmployee.has(employee.id));
    if (employees.length === 0) {
      return { error: "Enter a bonus amount for at least one employee." };
    }
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
  // who's already had pay runs this year. Shared by every run type,
  // including 13th month: a lump sum is taxed on top of this position too.
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

  let totalGrossKobo = 0n;
  let totalNetKobo = 0n;
  const allPeriodComponents: PayComponent[][] = [];
  const loanRepaymentsPayload: { loan_id: string; employee_id: string; amount_kobo: number }[] = [];
  const expenseReimbursementsPayload: { expense_id: string; employee_id: string }[] = [];
  const leaveDeductionsPayload: { leave_request_id: string; employee_id: string }[] = [];
  const attendanceDeductionsPayload: { attendance_record_id: string; employee_id: string }[] = [];
  const overtimePaymentsPayload: { overtime_request_id: string; employee_id: string }[] = [];

  interface PayslipPayload {
    [key: string]: Json | undefined;
    employee_id: string;
    gross_kobo: number;
    pensionable_kobo: number;
    pension_employee_kobo: number;
    pension_employer_kobo: number;
    nhf_kobo: number;
    rent_relief_kobo: number;
    chargeable_income_kobo: number;
    paye_kobo: number;
    employee_deductions_kobo: number;
    net_kobo: number;
    cumulative_chargeable_income_before_kobo: number;
    cumulative_paye_paid_before_kobo: number;
    taxable_reimbursement_kobo?: number;
    non_taxable_reimbursement_kobo?: number;
    unpaid_leave_deduction_kobo?: number;
    benefit_employer_cost_kobo?: number;
    benefit_employee_deduction_kobo?: number;
    attendance_absence_deduction_kobo?: number;
    overtime_pay_kobo?: number;
    new_hire_proration_deduction_kobo?: number;
    postings: { account_code: string; direction: string; amount_kobo: number }[];
  }

  let payslipsPayload: PayslipPayload[];

  if (frequency === "thirteenth_month") {
    // 13th Month: one month's basic salary per active employee, taxed on
    // top of whatever they've already earned this year via the same
    // cumulative mechanism as a regular run — but otherwise standalone.
    // No leave/attendance/overtime/reimbursement/loan/benefit adjustments
    // apply here; those are regular-run concepts a lump-sum disbursement
    // doesn't carry. See deriveLumpSumPayslip for why it's never
    // pensionable and never in the NHF or NSITF base.
    payslipsPayload = employees.map((employee) => {
      const prior = priorStateByEmployee.get(employee.id);
      const amountKobo = BigInt(employee.basic_kobo) / 12n;

      const result = deriveLumpSumPayslip(
        {
          kind: "thirteenth_month",
          amountKobo,
          cumulativeChargeableIncomeBeforeKobo: prior?.chargeableIncomeKobo ?? 0n,
          cumulativePayePaidBeforeKobo: prior?.payePaidAfterKobo ?? 0n,
        },
        NG_2026_1,
      );

      allPeriodComponents.push(result.periodComponents);
      totalGrossKobo += result.grossKobo;
      totalNetKobo += result.netKobo;

      const postings = [
        { account_code: "thirteenth_month_expense", direction: "debit", amount_kobo: result.grossKobo },
        { account_code: "net_pay_payable", direction: "credit", amount_kobo: result.netKobo },
        { account_code: "paye_payable", direction: "credit", amount_kobo: result.payeKobo },
      ].filter((posting) => posting.amount_kobo > 0n);

      return {
        employee_id: employee.id,
        gross_kobo: Number(result.grossKobo),
        pensionable_kobo: 0,
        pension_employee_kobo: 0,
        pension_employer_kobo: 0,
        nhf_kobo: 0,
        rent_relief_kobo: 0,
        chargeable_income_kobo: Number(result.chargeableIncomeKobo),
        paye_kobo: Number(result.payeKobo),
        employee_deductions_kobo: Number(result.payeKobo),
        net_kobo: Number(result.netKobo),
        cumulative_chargeable_income_before_kobo: Number(prior?.chargeableIncomeKobo ?? 0n),
        cumulative_paye_paid_before_kobo: Number(prior?.payePaidAfterKobo ?? 0n),
        postings: postings.map((posting) => ({ ...posting, amount_kobo: Number(posting.amount_kobo) })),
      };
    });
  } else if (frequency === "bonus") {
    // Bonus: a discretionary, admin-entered amount per employee, taxed on
    // top of whatever they've already earned this year via the same
    // cumulative mechanism as 13th month — same standalone treatment
    // otherwise (no leave/attendance/overtime/reimbursement/loan/benefit
    // adjustments; never pensionable, never in the NHF or NSITF base).
    payslipsPayload = employees.map((employee) => {
      const prior = priorStateByEmployee.get(employee.id);
      const amountKobo = bonusAmountByEmployee.get(employee.id)!;

      const result = deriveLumpSumPayslip(
        {
          kind: "bonus",
          amountKobo,
          cumulativeChargeableIncomeBeforeKobo: prior?.chargeableIncomeKobo ?? 0n,
          cumulativePayePaidBeforeKobo: prior?.payePaidAfterKobo ?? 0n,
        },
        NG_2026_1,
      );

      allPeriodComponents.push(result.periodComponents);
      totalGrossKobo += result.grossKobo;
      totalNetKobo += result.netKobo;

      const postings = [
        { account_code: "bonus_expense", direction: "debit", amount_kobo: result.grossKobo },
        { account_code: "net_pay_payable", direction: "credit", amount_kobo: result.netKobo },
        { account_code: "paye_payable", direction: "credit", amount_kobo: result.payeKobo },
      ].filter((posting) => posting.amount_kobo > 0n);

      return {
        employee_id: employee.id,
        gross_kobo: Number(result.grossKobo),
        pensionable_kobo: 0,
        pension_employee_kobo: 0,
        pension_employer_kobo: 0,
        nhf_kobo: 0,
        rent_relief_kobo: 0,
        chargeable_income_kobo: Number(result.chargeableIncomeKobo),
        paye_kobo: Number(result.payeKobo),
        employee_deductions_kobo: Number(result.payeKobo),
        net_kobo: Number(result.netKobo),
        cumulative_chargeable_income_before_kobo: Number(prior?.chargeableIncomeKobo ?? 0n),
        cumulative_paye_paid_before_kobo: Number(prior?.payePaidAfterKobo ?? 0n),
        postings: postings.map((posting) => ({ ...posting, amount_kobo: Number(posting.amount_kobo) })),
      };
    });
  } else {
    const regularFrequency = frequency as PayFrequency;

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

    // Unprocessed absences from the weekly attendance grid are deducted this
    // run too — same daily-rate formula as unpaid leave, but a distinct
    // source (an after-the-fact admin/HR record, not an employee-approved
    // request), so it's tracked as its own payload array and payslip column.
    const { data: unprocessedAbsences } = await supabase
      .from("attendance_records")
      .select("id, employee_id")
      .eq("org_id", membership.org_id)
      .eq("status", "absent")
      .is("paid_pay_run_id", null);

    const absencesByEmployee = new Map<string, NonNullable<typeof unprocessedAbsences>>();
    for (const absence of unprocessedAbsences ?? []) {
      const list = absencesByEmployee.get(absence.employee_id) ?? [];
      list.push(absence);
      absencesByEmployee.set(absence.employee_id, list);
    }

    // Approved overtime requests are paid out this run — earned income, not
    // a claim to reimburse, so there's no separate "unpaid" table to query
    // like expenses/loans: an approved request stays payable until a pay run
    // marks it 'paid' (mirrors the expense-reimbursement lifecycle exactly).
    const { data: approvedOvertime } = await supabase
      .from("overtime_requests")
      .select("id, employee_id, hours, rate_multiplier_bps")
      .eq("org_id", membership.org_id)
      .eq("status", "approved");

    const overtimeByEmployee = new Map<string, NonNullable<typeof approvedOvertime>>();
    for (const request of approvedOvertime ?? []) {
      const list = overtimeByEmployee.get(request.employee_id) ?? [];
      list.push(request);
      overtimeByEmployee.set(request.employee_id, list);
    }

    // Active benefit enrollments apply every run, automatically, for as long
    // as they stay active — no claim to approve, no balance to pay down.
    // Employer cost is a company cost (like NSITF or the pension employer
    // share); employee cost is a post-tax deduction (like a loan repayment).
    const { data: activeEnrollments } = await supabase
      .from("employee_benefit_enrollments")
      .select("employee_id, benefit_plans(employer_cost_kobo, employee_cost_kobo)")
      .eq("org_id", membership.org_id)
      .eq("status", "active")
      .order("enrolled_at", { ascending: true });

    const enrollmentsByEmployee = new Map<string, NonNullable<typeof activeEnrollments>>();
    for (const enrollment of activeEnrollments ?? []) {
      const list = enrollmentsByEmployee.get(enrollment.employee_id) ?? [];
      list.push(enrollment);
      enrollmentsByEmployee.set(enrollment.employee_id, list);
    }

    payslipsPayload = employees.map((employee) => {
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
          frequency: regularFrequency,
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
      const annualContractualKobo =
        BigInt(employee.basic_kobo) + BigInt(employee.housing_kobo) + BigInt(employee.transport_kobo);
      const dailyRateKobo = annualContractualKobo / 365n;
      for (const leave of unpaidLeaveByEmployee.get(employee.id) ?? []) {
        unpaidLeaveDeductionKobo += dailyRateKobo * BigInt(leave.days);
        leaveDeductionsPayload.push({ leave_request_id: leave.id, employee_id: employee.id });
      }

      // Unprocessed attendance absences reduce gross the same way — same
      // formula, distinct source and stored column (see migration comment).
      let attendanceAbsenceDeductionKobo = 0n;
      for (const absence of absencesByEmployee.get(employee.id) ?? []) {
        attendanceAbsenceDeductionKobo += dailyRateKobo;
        attendanceDeductionsPayload.push({ attendance_record_id: absence.id, employee_id: employee.id });
      }

      // New-hire proration: an employee whose hire date falls inside this
      // period wasn't employed for the whole thing, so the days before
      // their hire date are deducted the same daily-rate way as unpaid
      // leave/attendance — calendar days, not working days (see migration
      // comment for why this basis was chosen). daysNotEmployed naturally
      // clamps to 0 for an employee hired on or before period_start, and to
      // the full period if hire_date falls after period_end (a hire date
      // entered ahead of an actual start date), rather than needing a
      // separate branch for either edge. Termination proration is handled
      // by Final Settlement, not here — terminated employees never reach
      // this regular-run query in the first place.
      let newHireProrationDeductionKobo = 0n;
      if (employee.hire_date) {
        const hireTime = Date.parse(employee.hire_date);
        const periodStartTime = Date.parse(periodStart);
        const periodEndTime = Date.parse(periodEnd);
        const lastUnemployedTime = Math.min(hireTime - 86_400_000, periodEndTime);
        const daysNotEmployed = Math.max(0, Math.round((lastUnemployedTime - periodStartTime) / 86_400_000) + 1);
        newHireProrationDeductionKobo = dailyRateKobo * BigInt(daysNotEmployed);
      }

      const daysOffDeductionKobo = unpaidLeaveDeductionKobo + attendanceAbsenceDeductionKobo + newHireProrationDeductionKobo;

      // Approved overtime is earned income: always taxable and added to
      // chargeable income (unlike a reimbursement, there's no non-taxable
      // overtime), but never pensionable — pension is computed on Basic +
      // Housing + Transport only (see NG_2026_1), not overtime pay. Hourly
      // rate is annual basic salary ÷ 12 ÷ 173 standard monthly hours — a
      // disclosed simplification (the common Nigerian payroll convention),
      // not a claimed statutory formula. Hours (numeric(4,1)) are scaled by
      // 10 to stay in integer bigint math throughout, matching this
      // codebase's integer-only money rule.
      let overtimePayKobo = 0n;
      const hourlyRateKobo = BigInt(employee.basic_kobo) / 12n / 173n;
      for (const request of overtimeByEmployee.get(employee.id) ?? []) {
        const hoursScaledByTen = BigInt(Math.round(Number(request.hours) * 10));
        overtimePayKobo += (hourlyRateKobo * hoursScaledByTen * BigInt(request.rate_multiplier_bps)) / 1000n;
        overtimePaymentsPayload.push({ overtime_request_id: request.id, employee_id: employee.id });
      }

      const chargeableIncomeKobo = clampNonNegative(
        result.chargeableIncomeKobo + taxableReimbursementKobo + overtimePayKobo - daysOffDeductionKobo,
      );
      const payeKobo =
        taxableReimbursementKobo > 0n || overtimePayKobo > 0n || daysOffDeductionKobo > 0n
          ? computeCumulativePeriodPaye(chargeableIncomeKobo, prior?.payePaidAfterKobo ?? 0n, NG_2026_1)
          : result.payeKobo;
      const grossKobo = clampNonNegative(result.grossKobo + reimbursementKobo + overtimePayKobo - daysOffDeductionKobo);
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
      // Deduction priority is explicit and, unlike loans above, was
      // previously unenforced here: statutory deductions are never skipped,
      // loans are already capped against whatever net pay remains, so
      // benefits are last in line for what loans left behind. A premium
      // isn't divisible like a loan balance, so an enrollment that can't be
      // fully covered by the net remaining is skipped in its entirety
      // (neither side charged this run) rather than partially deducted —
      // earliest-enrolled first, so a long-standing benefit isn't bumped by
      // one added later. This is what keeps net pay from ever going
      // negative, which nothing enforced before this fix.
      let benefitEmployerCostKobo = 0n;
      let benefitEmployeeDeductionKobo = 0n;
      const netAfterLoansKobo = netBeforeLoanKobo - loanDeductionKobo;
      for (const enrollment of enrollmentsByEmployee.get(employee.id) ?? []) {
        const employeeCostKobo = BigInt(enrollment.benefit_plans?.employee_cost_kobo ?? 0);
        if (benefitEmployeeDeductionKobo + employeeCostKobo > netAfterLoansKobo) continue;
        benefitEmployerCostKobo += BigInt(enrollment.benefit_plans?.employer_cost_kobo ?? 0);
        benefitEmployeeDeductionKobo += employeeCostKobo;
      }

      const netKobo = clampNonNegative(netBeforeLoanKobo - loanDeductionKobo - benefitEmployeeDeductionKobo);
      const employeeDeductionsKobo =
        result.pensionEmployeeKobo + result.nhfKobo + payeKobo + loanDeductionKobo + benefitEmployeeDeductionKobo;
      totalGrossKobo += grossKobo;
      totalNetKobo += netKobo;

      // Employer costs (pension employer share, benefits) are tracked on
      // their own ledger lines — never folded into an employee-facing
      // deduction total. payroll_expense is reduced by the unpaid-leave and
      // attendance-absence amounts directly (that pay was never incurred),
      // which is what keeps this posting set balanced without a separate
      // contra-account line.
      const postings = [
        {
          account_code: "payroll_expense",
          direction: "debit",
          amount_kobo: clampNonNegative(result.grossKobo - daysOffDeductionKobo),
        },
        { account_code: "expense_reimbursement_expense", direction: "debit", amount_kobo: reimbursementKobo },
        { account_code: "overtime_pay_expense", direction: "debit", amount_kobo: overtimePayKobo },
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
        attendance_absence_deduction_kobo: Number(attendanceAbsenceDeductionKobo),
        overtime_pay_kobo: Number(overtimePayKobo),
        new_hire_proration_deduction_kobo: Number(newHireProrationDeductionKobo),
        postings: postings.map((posting) => ({ ...posting, amount_kobo: Number(posting.amount_kobo) })),
      };
    });
  }

  // NSITF is computed on the whole run's total payroll base, not per
  // employee — an org-level cost, never an employee deduction. Correctly
  // zero for a 13th-month or bonus run: every component pushed above is
  // tagged kind "thirteenth_month"/"bonus", never "regular".
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
      attendance_deductions: attendanceDeductionsPayload,
      overtime_payments: overtimePaymentsPayload,
    },
  });

  if (rpcError) {
    return { error: rpcError.message };
  }

  const approverIds = await getOrgRoleUserIds(supabase, membership.org_id, ["admin", "payroll_manager"]);
  await notifyUsers(supabase, {
    orgId: membership.org_id,
    recipientUserIds: approverIds.filter((id) => id !== user.id),
    type: "pay_run_created",
    message: `Payroll run for ${periodStart} – ${periodEnd} was created.`,
    link: "/payroll",
  });

  revalidatePath("/payroll");
  revalidatePath("/loans");
  revalidatePath("/expenses");
  revalidatePath("/leave");
  revalidatePath("/benefits");
  revalidatePath("/attendance");
  revalidatePath("/overtime");
  redirect("/payroll");
}
