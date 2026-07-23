import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { TinBadge, LoanStatusBadge, ExpenseStatusBadge, LeaveStatusBadge } from "@/components/Badge";
import { LoanRequestForm } from "./LoanRequestForm";
import { ExpenseClaimForm } from "./ExpenseClaimForm";
import { LeaveRequestForm } from "./LeaveRequestForm";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase.from("employees").select("*").eq("user_id", user.id).maybeSingle();

  if (!employee) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
        <header className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overview</span>
          <h1 className="text-[22px] font-extrabold text-ink">No employee record linked</h1>
        </header>
        <p className="text-[13px] text-ink-soft">
          Your account isn&apos;t linked to an employee record yet. Ask your employer to send an invite from your
          employee profile.
        </p>
      </div>
    );
  }

  const { data: latestPayslip } = await supabase
    .from("payslips")
    .select("*, pay_runs(period_start, period_end)")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: loans } = await supabase
    .from("loans")
    .select("*")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });

  const { data: leaveRequests } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });

  const { data: benefitEnrollments } = await supabase
    .from("employee_benefit_enrollments")
    .select("*, benefit_plans(name, category, employer_cost_kobo, employee_cost_kobo)")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overview</span>
        <h1 className="text-[22px] font-extrabold text-ink">{employee.full_name}</h1>
        <p className="text-[13px] text-ink-soft">Signed in as {user.email}</p>
      </header>

      <div className="flex items-center justify-between rounded-card border border-border bg-surface p-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">TIN status</span>
          <span className="text-[13px] text-ink-soft">{employee.tin ?? "Not on file"}</span>
        </div>
        <TinBadge tin={employee.tin} />
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Latest payslip</span>

        {latestPayslip ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-[13px] font-bold text-ink">
              {latestPayslip.pay_runs?.period_start} – {latestPayslip.pay_runs?.period_end}
            </p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Row label="Gross" amountKobo={latestPayslip.gross_kobo} />
              <Row label="Pension (employee)" amountKobo={-latestPayslip.pension_employee_kobo} />
              <Row label="NHF" amountKobo={-latestPayslip.nhf_kobo} />
              <Row label="Rent relief" amountKobo={latestPayslip.rent_relief_kobo} />
              <Row label="Chargeable income" amountKobo={latestPayslip.chargeable_income_kobo} />
              <Row label="PAYE" amountKobo={-latestPayslip.paye_kobo} />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-extrabold text-ink">
                <span>Net pay</span>
                <span>{formatKobo(BigInt(latestPayslip.net_kobo))}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-soft">No payslips yet.</p>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Loans &amp; advances</span>

        {loans && loans.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {loans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ink">{formatKobo(BigInt(loan.principal_kobo))}</span>
                  <span className="text-[12px] text-ink-soft">
                    {loan.status === "approved" || loan.status === "completed"
                      ? `${formatKobo(BigInt(loan.outstanding_kobo))} outstanding · ${formatKobo(BigInt(loan.monthly_repayment_kobo))}/mo`
                      : (loan.reason ?? "No reason given")}
                  </span>
                </div>
                <LoanStatusBadge status={loan.status} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <LoanRequestForm />
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Expense claims</span>

        {expenses && expenses.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ink">{formatKobo(BigInt(expense.amount_kobo))}</span>
                  <span className="text-[12px] text-ink-soft">
                    {expense.description}
                    {expense.taxable !== null ? (expense.taxable ? " · taxable" : " · non-taxable") : ""}
                  </span>
                </div>
                <ExpenseStatusBadge status={expense.status} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <ExpenseClaimForm />
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave &amp; attendance</span>
          <span className="text-[13px] font-bold text-ink">
            {Number(employee.annual_leave_balance_days)} days left
          </span>
        </div>

        {leaveRequests && leaveRequests.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {leaveRequests.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ink capitalize">
                    {leave.leave_type} · {leave.days} day{leave.days === 1 ? "" : "s"}
                  </span>
                  <span className="text-[12px] text-ink-soft">
                    {leave.start_date} – {leave.end_date}
                  </span>
                </div>
                <LeaveStatusBadge status={leave.status} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <LeaveRequestForm />
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Benefits</span>

        {benefitEnrollments && benefitEnrollments.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {benefitEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ink">{enrollment.benefit_plans?.name ?? "—"}</span>
                  <span className="text-[12px] text-ink-soft capitalize">
                    {enrollment.benefit_plans?.category.replace("_", " ") ?? ""}
                    {Number(enrollment.benefit_plans?.employee_cost_kobo ?? 0) > 0 &&
                      ` · ${formatKobo(BigInt(enrollment.benefit_plans!.employee_cost_kobo))}/period from your pay`}
                  </span>
                </div>
                <span className="text-[12px] text-ink-soft">
                  Employer cost {formatKobo(BigInt(enrollment.benefit_plans?.employer_cost_kobo ?? 0))}/period
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-soft">Not enrolled in any benefit plans.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, amountKobo }: { label: string; amountKobo: number }) {
  const negative = amountKobo < 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={negative ? "font-bold text-bad" : "font-bold text-ink"}>
        {negative ? "-" : ""}
        {formatKobo(BigInt(Math.abs(amountKobo)))}
      </span>
    </div>
  );
}
