import Link from "next/link";
import { redirect } from "next/navigation";
import { NG_2026_1 } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { PayRunStatusBadge } from "@/components/Badge";
import { Avatar, ApprovalDonut, DeadlineItem, MonthlyPayrollCostChart, StatTile } from "./widgets";

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TERMINAL_STATUSES = ["approved", "paid", "completed"];
const APPROVAL_TABLES = ["loans", "expenses", "overtime_requests", "leave_requests", "leave_encashment_requests"] as const;

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

/** Next calendar occurrence of a fixed day-of-month from `today` —
 * payment-relative schemes (pension, NHF) have no fixed calendar day and
 * are deliberately left out of this list rather than guessed. */
function nextMonthlyDeadline(dayOfMonth: number, today: Date): Date {
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dayOfMonth));
  if (candidate < today) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate;
}

function nextAnnualDeadline(monthDay: string, today: Date): Date {
  const [month, day] = monthDay.split("-").map(Number);
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), (month ?? 1) - 1, day ?? 1));
  if (candidate < today) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate;
}

function formatDeadlineDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABEL[date.getUTCMonth()]}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("role, organizations(name, default_pay_frequency, states_of_operation)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const membership = memberships[0]!;

  if (membership.role === "employee") {
    redirect("/me");
  }

  const org = membership.organizations;
  const today = new Date();

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const greetingName = myEmployee?.full_name ?? user.email ?? "there";

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10);

  const [
    { count: activeEmployeeCount },
    { count: newHireCount },
    { count: tinMissingCount },
    ...approvalTableRows
  ] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("hire_date", thirtyDaysAgoIso),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active").is("tin", null),
    ...APPROVAL_TABLES.map((table) => supabase.from(table).select("status")),
  ]);

  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  for (const result of approvalTableRows) {
    for (const row of result.data ?? []) {
      if (row.status === "pending") pendingCount++;
      else if (row.status === "rejected") rejectedCount++;
      else if (TERMINAL_STATUSES.includes(row.status)) approvedCount++;
    }
  }

  const { data: recentPayRuns } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, frequency, status, net_kobo")
    .order("period_end", { ascending: false })
    .limit(5);

  const { data: payRunsForChart } = await supabase
    .from("pay_runs")
    .select("period_end, net_kobo, status")
    .eq("status", "posted")
    .order("period_end", { ascending: false })
    .limit(100);

  const totalsByMonth = new Map<string, bigint>();
  for (const run of payRunsForChart ?? []) {
    const key = monthKey(run.period_end);
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0n) + BigInt(run.net_kobo));
  }

  const chartMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { label: MONTH_LABEL[d.getUTCMonth()]!, totalKobo: totalsByMonth.get(key) ?? 0n };
  });

  const { data: recentEmployees } = await supabase
    .from("employees_masked")
    .select("id, full_name, email, department_name")
    .order("full_name")
    .limit(6);

  const rv = NG_2026_1;
  const deadlines = [
    { date: nextMonthlyDeadline(rv.paye.remittance.dueDayOfFollowingMonth, today), title: "PAYE remittance", authority: "State IRS" },
    { date: nextMonthlyDeadline(rv.nsitf.remittance.dueDayOfFollowingMonth, today), title: "NSITF remittance", authority: "NSITF" },
    { date: nextMonthlyDeadline(rv.wht.remittance.dueDayOfFollowingMonth, today), title: "WHT & VAT remittance", authority: "NRS / FIRS" },
    { date: nextAnnualDeadline(rv.itf.remittance.dueAnnuallyOn, today), title: "ITF annual filing", authority: "ITF" },
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, ...rest }) => ({ dateLabel: formatDeadlineDate(date), ...rest }));

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          {today.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">Hi, {greetingName.split(" ")[0]}</h1>
        <p className="text-[13px] text-ink-soft">
          {org?.name ?? "Your organization"} · {org?.default_pay_frequency ?? "—"} pay frequency
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total Employees" value={String(activeEmployeeCount ?? 0)} caption="Active headcount" />
        <StatTile label="New Hires" value={String(newHireCount ?? 0)} caption="In the last 30 days" />
        <StatTile
          label="Pending Approvals"
          value={String(pendingCount)}
          caption="Loans, expenses, overtime & leave"
        />
        <StatTile
          label="TIN Missing"
          value={String(tinMissingCount ?? 0)}
          caption={`Of ${activeEmployeeCount ?? 0} active employees`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Approvals</span>
          <h2 className="mt-1 mb-4 text-[15px] font-extrabold text-ink">Loans, expenses, overtime & leave</h2>
          <ApprovalDonut approved={approvedCount} pending={pendingCount} rejected={rejectedCount} />
        </div>

        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Cost</span>
          <h2 className="mt-1 text-[15px] font-extrabold text-ink">Net pay, last 6 months</h2>
          <MonthlyPayrollCostChart months={chartMonths} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-[13px] font-extrabold text-ink">Recent Pay Runs</span>
              <Link href="/payroll" className="text-[12px] font-bold text-primary">
                See all
              </Link>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {recentPayRuns && recentPayRuns.length > 0 ? (
                  recentPayRuns.map((run) => (
                    <tr key={run.id} className="border-b border-border text-[13px] last:border-b-0">
                      <td className="px-4 py-[10px] font-bold text-ink">
                        <Link href={`/payroll/${run.id}`} className="text-primary">
                          {run.period_start} – {run.period_end}
                        </Link>
                      </td>
                      <td className="px-4 py-[10px] text-ink-soft capitalize">{run.frequency}</td>
                      <td className="px-4 py-[10px]">
                        <PayRunStatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-[10px] text-right font-bold text-ink">{formatKobo(BigInt(run.net_kobo))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-[13px] text-ink-soft">No pay runs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-[13px] font-extrabold text-ink">Employee Directory</span>
              <Link href="/employees" className="text-[12px] font-bold text-primary">
                See all
              </Link>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {recentEmployees && recentEmployees.length > 0 ? (
                  recentEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-border text-[13px] last:border-b-0">
                      <td className="px-4 py-[10px]">
                        <div className="flex items-center gap-3">
                          <Avatar name={employee.full_name ?? "?"} />
                          <div className="flex flex-col">
                            <span className="font-bold text-ink">{employee.full_name ?? "—"}</span>
                            <span className="text-[12px] text-ink-soft">{employee.email ?? "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-[10px] text-right text-ink-soft">{employee.department_name ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-[13px] text-ink-soft">No employees yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-surface p-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Today</span>
            <p className="mt-1 text-[19px] font-extrabold text-ink">
              {today.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-extrabold text-ink">Upcoming Filings</span>
              <Link href="/compliance" className="text-[12px] font-bold text-primary">
                See all
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {deadlines.map((deadline) => (
                <DeadlineItem key={deadline.title} {...deadline} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
