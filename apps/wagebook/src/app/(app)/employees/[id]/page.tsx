import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, getProbationStatus, getContractStatus } from "@/lib/format";
import {
  Badge,
  TinBadge,
  EmployeeStatusBadge,
  BankDetailsBadge,
  ProbationBadge,
  ContractStatusBadge,
  LoanStatusBadge,
  ExpenseStatusBadge,
  OvertimeStatusBadge,
  LeaveStatusBadge,
  LeaveEncashmentStatusBadge,
} from "@/components/Badge";

type ActivityEntry = {
  date: string;
  label: string;
  meta: string;
  badge: React.ReactNode;
};

const detailRow = "flex items-center justify-between gap-3 border-b border-border py-2 text-[13px] last:border-b-0";

export default async function ViewEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // employees_masked, same as the edit page: an hr_manager viewer of a
  // salary_masked employee gets null salary/bank columns back — the
  // "Restricted" fallback below reacts to that, not a separate role check.
  const { data: employee } = await supabase.from("employees_masked").select("*").eq("id", id).maybeSingle();
  if (!employee) notFound();

  const { data: manager } = employee.manager_id
    ? await supabase.from("employees").select("full_name").eq("id", employee.manager_id).maybeSingle()
    : { data: null };

  const [
    { data: leaveRequests },
    { data: loans },
    { data: expenses },
    { data: overtimeRequests },
    { data: leaveEncashments },
    { data: statusHistory },
    { data: compensationHistory },
    { data: payslips },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("loans").select("*").eq("employee_id", id).order("created_at", { ascending: false }).limit(15),
    supabase.from("expenses").select("*").eq("employee_id", id).order("created_at", { ascending: false }).limit(15),
    supabase
      .from("overtime_requests")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("leave_encashment_requests")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("employee_status_history")
      .select("*")
      .eq("employee_id", id)
      .order("changed_at", { ascending: false })
      .limit(15),
    supabase
      .from("employee_compensation_history")
      .select("*")
      .eq("employee_id", id)
      .order("changed_at", { ascending: false })
      .limit(15),
    supabase
      .from("payslips")
      .select("gross_kobo, net_kobo, created_at, pay_runs(period_start, period_end)")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const activity: ActivityEntry[] = [
    ...(leaveRequests ?? []).map((r) => ({
      date: r.created_at,
      label: `${r.leave_type.charAt(0).toUpperCase()}${r.leave_type.slice(1)} leave`,
      meta: `${r.days} day${r.days === 1 ? "" : "s"} · ${r.start_date} – ${r.end_date}`,
      badge: <LeaveStatusBadge status={r.status} />,
    })),
    ...(loans ?? []).map((r) => ({
      date: r.created_at,
      label: "Loan request",
      meta: `${formatKobo(BigInt(r.principal_kobo))} · ${formatKobo(BigInt(r.monthly_repayment_kobo))}/mo`,
      badge: <LoanStatusBadge status={r.status} />,
    })),
    ...(expenses ?? []).map((r) => ({
      date: r.created_at,
      label: "Expense claim",
      meta: `${r.description} · ${formatKobo(BigInt(r.amount_kobo))}`,
      badge: <ExpenseStatusBadge status={r.status} />,
    })),
    ...(overtimeRequests ?? []).map((r) => ({
      date: r.created_at,
      label: "Overtime",
      meta: `${r.hours}h on ${r.work_date} · ${(r.rate_multiplier_bps / 10000).toFixed(1)}×`,
      badge: <OvertimeStatusBadge status={r.status} />,
    })),
    ...(leaveEncashments ?? []).map((r) => ({
      date: r.created_at,
      label: "Leave encashment",
      meta: `${r.days_requested} day${r.days_requested === 1 ? "" : "s"}`,
      badge: <LeaveEncashmentStatusBadge status={r.status} />,
    })),
    ...(statusHistory ?? []).map((r) => ({
      date: r.changed_at,
      label: "Status changed",
      meta: `${r.old_status ?? "—"} → ${r.new_status}`,
      badge: <Badge tone="neutral">{r.new_status}</Badge>,
    })),
    ...(compensationHistory ?? []).map((r) => {
      const oldTotal = r.old_basic_kobo + r.old_housing_kobo + r.old_transport_kobo;
      const newTotal = r.new_basic_kobo + r.new_housing_kobo + r.new_transport_kobo;
      return {
        date: r.changed_at,
        label: "Compensation changed",
        meta: `${formatKobo(BigInt(oldTotal))}/yr → ${formatKobo(BigInt(newTotal))}/yr`,
        badge: <Badge tone="neutral">Updated</Badge>,
      };
    }),
    ...(payslips ?? []).map((r) => ({
      date: r.created_at,
      label: "Paid",
      meta: r.pay_runs
        ? `${r.pay_runs.period_start} – ${r.pay_runs.period_end} · Net ${formatKobo(BigInt(r.net_kobo))}`
        : `Net ${formatKobo(BigInt(r.net_kobo))}`,
      badge: <Badge tone="good">Paid</Badge>,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
          <h1 className="text-[22px] font-extrabold text-ink">{employee.full_name}</h1>
        </div>
        <Link
          href={`/employees/${employee.id}/edit`}
          className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
        >
          Edit
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeStatusBadge status={employee.status ?? "active"} />
        <ProbationBadge status={getProbationStatus(employee.probation_end_date, employee.confirmed ?? false)} />
        <ContractStatusBadge
          status={getContractStatus(employee.employment_type ?? "permanent", employee.contract_end_date)}
        />
        <TinBadge tin={employee.tin} />
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Details</span>
        <div className="mt-3">
          <div className={detailRow}>
            <span className="text-ink-soft">Employee ID</span>
            <span className="font-bold text-ink">{employee.employee_id ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Email</span>
            <span className="font-bold text-ink">{employee.email ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Department</span>
            <span className="font-bold text-ink">{employee.department_name ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Branch</span>
            <span className="font-bold text-ink">{employee.branch_name ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">State of residence</span>
            <span className="font-bold text-ink">{employee.state_of_residence ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Manager</span>
            <span className="font-bold text-ink">{manager?.full_name ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Hire date</span>
            <span className="font-bold text-ink">{employee.hire_date ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Basic (₦/yr)</span>
            <span className="font-bold text-ink">
              {employee.basic_kobo !== null ? formatKobo(BigInt(employee.basic_kobo)) : "Restricted"}
            </span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">PFA</span>
            <span className="font-bold text-ink">{employee.pfa ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Bank details</span>
            <BankDetailsBadge bankAccountNumber={employee.bank_account_number} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Activity</span>
        <div className="mt-3">
          {activity.length === 0 ? (
            <p className="text-[13px] text-ink-soft">No activity recorded yet.</p>
          ) : (
            activity.map((item, index) => (
              <div key={index} className={detailRow}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-ink">{item.label}</span>
                  <span className="text-[12px] text-ink-soft">{item.meta}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {item.badge}
                  <span className="text-[11px] text-ink-soft">
                    {new Date(item.date).toLocaleDateString("en-NG")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
