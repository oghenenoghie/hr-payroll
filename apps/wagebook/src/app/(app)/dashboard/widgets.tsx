import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";
import { NG_2026_1 } from "@plutus/compliance";
import type { Kobo } from "@plutus/compliance";
import { formatKobo } from "@/lib/format";
import { AnimatedCount } from "@/components/AnimatedCount";
import { PayrollTrendChart } from "./PayrollTrendChart";
import { PayRunStatusBadge } from "@/components/Badge";
import {
  BuildingIcon,
  ClockIcon,
  BanknoteIcon,
  PeopleIcon,
  ShieldIcon,
  ReceiptIcon,
  PieChartIcon,
  CoinsIcon,
  BriefcaseIcon,
  TargetIcon,
  CapIcon,
  CalculatorIcon,
  CalendarIcon,
} from "@/components/icons";

type WidgetProps = { supabase: SupabaseClient<Database>; orgId: string };
type WidgetIcon = React.ComponentType<{ className?: string }>;

const cardClass = "rounded-card border border-border bg-surface p-6 transition-colors duration-150 group-hover:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const statClass = "mt-1 text-[22px] font-extrabold text-ink";
const rowClass = "flex items-center justify-between gap-3 text-[13px]";

// A small leading icon chip beside every widget's label, giving the grid
// a scannable visual anchor per card the way a plain uppercase label
// alone didn't — every widget uses this same header shape now, rather
// than only some of them promoting a hero stat and others not.
function WidgetHeader({ icon: Icon, label }: { icon: WidgetIcon; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-dark">
        <Icon className="h-4 w-4" />
      </span>
      <span className={labelClass}>{label}</span>
    </div>
  );
}

// Turns a plain link-row into a single-hue magnitude bar — the row's
// value scaled against the widget's own largest value, painted as a
// tint behind the label rather than a separate mini-chart, so a widget
// that's already a short list of counts also reads as "which of these
// is biggest" at a glance. Markup/links/hover stay the row's own
// (rowClass), this only adds the bar behind it.
function BarRow({ href, label, value, maxValue }: { href: string; label: string; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / maxValue) * 100)) : 0;
  return (
    <Link href={href} className="relative block overflow-hidden rounded-control hover:text-primary">
      <span aria-hidden className="absolute inset-y-0 left-0 z-0 bg-primary-tint" style={{ width: `${pct}%` }} />
      <span className={`${rowClass} relative z-10 px-1.5 py-1`}>
        <span>{label}</span>
        <span className="font-bold text-ink">{value}</span>
      </span>
    </Link>
  );
}

export async function OrgSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: org } = await supabase
    .from("organizations")
    .select("name, default_pay_frequency, states_of_operation")
    .eq("id", orgId)
    .maybeSingle();

  return (
    <div className={cardClass}>
      <WidgetHeader icon={BuildingIcon} label="Organization" />
      <p className="mt-1 text-[15px] font-extrabold text-ink">{org?.name ?? "Your organization"}</p>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <div className={rowClass}>
          <span>Pay frequency</span>
          <span className="font-bold text-ink">{org?.default_pay_frequency ?? "—"}</span>
        </div>
        <div className={rowClass}>
          <span>States of operation</span>
          <span className="font-bold text-ink">
            {org?.states_of_operation && org.states_of_operation.length > 0
              ? org.states_of_operation.join(", ")
              : "None yet"}
          </span>
        </div>
      </div>
    </div>
  );
}

export async function PendingApprovalsWidget({ supabase, orgId }: WidgetProps) {
  const [{ count: leave }, { count: loans }, { count: expenses }, { count: overtime }] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("loans").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("overtime_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
  ]);

  const total = (leave ?? 0) + (loans ?? 0) + (expenses ?? 0) + (overtime ?? 0);
  const maxValue = Math.max(leave ?? 0, loans ?? 0, expenses ?? 0, overtime ?? 0);

  return (
    <div className={cardClass}>
      <WidgetHeader icon={ClockIcon} label="Pending approvals" />
      <p className={statClass}>
        <AnimatedCount value={total} />
      </p>
      <div className="mt-3 flex flex-col gap-1 text-[13px] text-ink-soft">
        <BarRow href="/leave" label="Leave" value={leave ?? 0} maxValue={maxValue} />
        <BarRow href="/loans" label="Loans" value={loans ?? 0} maxValue={maxValue} />
        <BarRow href="/expenses" label="Expenses" value={expenses ?? 0} maxValue={maxValue} />
        <BarRow href="/overtime" label="Overtime" value={overtime ?? 0} maxValue={maxValue} />
      </div>
    </div>
  );
}

const RECENT_PAY_RUN_COUNT = 8;

export async function PayrollSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: recentRuns } = await supabase
    .from("pay_runs")
    .select("period_start, period_end, status, gross_kobo, net_kobo, employee_count")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(RECENT_PAY_RUN_COUNT);

  const latestRun = recentRuns?.[0] ?? null;
  // Chart reads left-to-right chronologically, opposite of the
  // most-recent-first order the query fetched (and the latest-run
  // summary above still needs).
  const trendPoints = [...(recentRuns ?? [])].reverse().map((run) => ({
    label: `${run.period_start} – ${run.period_end}`,
    netKobo: BigInt(run.net_kobo),
  }));

  return (
    <Link href="/payroll" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={BanknoteIcon} label="Most recent pay run" />
        {latestRun ? (
          <>
            <p className="mt-1 text-[15px] font-extrabold text-ink">
              {latestRun.period_start} – {latestRun.period_end}
            </p>
            <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
              <div className={rowClass}>
                <span>Status</span>
                <span className="font-bold capitalize text-ink">{latestRun.status}</span>
              </div>
              <div className={rowClass}>
                <span>Employees paid</span>
                <span className="font-bold text-ink">{latestRun.employee_count}</span>
              </div>
              <div className={rowClass}>
                <span>Net pay</span>
                <span className="font-bold text-ink">{formatKobo(BigInt(latestRun.net_kobo))}</span>
              </div>
            </div>
            {trendPoints.length > 1 && <PayrollTrendChart points={trendPoints} />}
          </>
        ) : (
          <p className={statClass}>No pay runs yet</p>
        )}
      </div>
    </Link>
  );
}

export async function WorkforceSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const cutoff = thirtyDays.toISOString().slice(0, 10);

  const [{ count: active }, { count: contractsEnding }, { count: probationsEnding }] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active")
      .lte("contract_end_date", cutoff)
      .not("contract_end_date", "is", null),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active")
      .eq("confirmed", false)
      .lte("probation_end_date", cutoff)
      .not("probation_end_date", "is", null),
  ]);

  return (
    <Link href="/employees" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={PeopleIcon} label="Active employees" />
        <p className={statClass}>
          <AnimatedCount value={active ?? 0} />
        </p>
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          <div className={rowClass}>
            <span>Contracts ending within 30 days</span>
            <span className="font-bold text-ink">{contractsEnding ?? 0}</span>
          </div>
          <div className={rowClass}>
            <span>Probations ending within 30 days</span>
            <span className="font-bold text-ink">{probationsEnding ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export async function ComplianceAuditWidget({ supabase, orgId }: WidgetProps) {
  const { data: events } = await supabase.rpc("get_org_audit_log", { p_org_id: orgId, p_limit: 5 });

  return (
    <Link href="/security/audit-log" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={ShieldIcon} label="Recent authentication activity" />
        {events && events.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
            {events.slice(0, 5).map((event, i) => (
              <div key={i} className={rowClass}>
                <span className="truncate">{event.actor_username ?? "Unknown"}</span>
                <span className="font-bold text-ink">{event.action ?? "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={statClass}>No recent events</p>
        )}
      </div>
    </Link>
  );
}

export async function AccountsSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const [{ count: outstandingBills }, { count: outstandingInvoices }] = await Promise.all([
    supabase
      .from("vendor_bills")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["pending_approval", "approved"]),
    supabase.from("customer_invoices").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "issued"),
  ]);

  const total = (outstandingBills ?? 0) + (outstandingInvoices ?? 0);
  const maxValue = Math.max(outstandingBills ?? 0, outstandingInvoices ?? 0);

  return (
    <div className={cardClass}>
      <WidgetHeader icon={ReceiptIcon} label="Accounts payable & receivable" />
      <p className={statClass}>
        <AnimatedCount value={total} />
      </p>
      <div className="mt-3 flex flex-col gap-1 text-[13px] text-ink-soft">
        <BarRow href="/bills" label="Bills awaiting payment" value={outstandingBills ?? 0} maxValue={maxValue} />
        <BarRow
          href="/invoices"
          label="Invoices awaiting collection"
          value={outstandingInvoices ?? 0}
          maxValue={maxValue}
        />
      </div>
    </div>
  );
}

// WHT withheld on a paid vendor bill is genuinely this org's obligation
// to remit — computeVendorInvoiceTotals withholds it from the vendor at
// payment, and pay_vendor_bill posts it to wht_payable at that point
// (20260811010000). VAT paid on a purchase is the opposite direction —
// input tax the vendor charged this org, not something this org owes
// FIRS on the vendor's behalf — so it's shown as a secondary, clearly-
// labelled figure rather than folded into the same "liability" framing
// as WHT. Both figures are lifetime-to-date, scoped to paid bills only
// (a pending/approved bill hasn't had its WHT actually withheld yet).
export async function VatWhtSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: bills } = await supabase
    .from("vendor_bills")
    .select("wht_kobo, vat_kobo")
    .eq("org_id", orgId)
    .eq("status", "paid");

  const whtWithheldKobo = (bills ?? []).reduce((sum, bill) => sum + BigInt(bill.wht_kobo), 0n);
  const vatPaidKobo = (bills ?? []).reduce((sum, bill) => sum + BigInt(bill.vat_kobo), 0n);

  return (
    <Link href="/bills" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={CalculatorIcon} label="VAT & WHT" />
        <p className={statClass}>{formatKobo(whtWithheldKobo)}</p>
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          <div className={rowClass}>
            <span>WHT withheld — due FIRS/NRS by the 21st</span>
            <span className="font-bold text-ink">{formatKobo(whtWithheldKobo)}</span>
          </div>
          <div className={rowClass}>
            <span>VAT paid on bills (input, not owed by this org)</span>
            <span className="font-bold text-ink">{formatKobo(vatPaidKobo)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export async function BudgetSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { count: activeCount } = await supabase
    .from("budgets")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { data: latestBudget } = await supabase
    .from("budgets")
    .select("name, period_start, period_end")
    .eq("org_id", orgId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Link href="/budgets" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={PieChartIcon} label="Budgets" />
        <p className={statClass}>
          <AnimatedCount value={activeCount ?? 0} />
        </p>
        {latestBudget && (
          <p className="mt-2 text-[13px] text-ink-soft">
            Most recent: <span className="font-bold text-ink">{latestBudget.name}</span> ({latestBudget.period_start} –{" "}
            {latestBudget.period_end})
          </p>
        )}
      </div>
    </Link>
  );
}

export async function CompensationSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const [{ count: grades }, { count: plans }, { count: enrollments }] = await Promise.all([
    supabase.from("job_grades").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("benefit_plans").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true),
    supabase.from("employee_benefit_enrollments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
  ]);

  return (
    <div className={cardClass}>
      <WidgetHeader icon={CoinsIcon} label="Compensation & benefits" />
      <p className={statClass}>
        <AnimatedCount value={grades ?? 0} />
      </p>
      <p className="text-[12px] text-ink-soft">Job grades</p>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/benefits" className={`${rowClass} hover:text-primary`}>
          <span>Active benefit plans</span>
          <span className="font-bold text-ink">{plans ?? 0}</span>
        </Link>
        <Link href="/benefits" className={`${rowClass} hover:text-primary`}>
          <span>Active enrollments</span>
          <span className="font-bold text-ink">{enrollments ?? 0}</span>
        </Link>
      </div>
    </div>
  );
}

export async function RecruitmentSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const [{ count: openReqs }, { count: inPipeline }, { count: upcomingInterviews }] = await Promise.all([
    supabase.from("job_requisitions").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("stage", "in", "(hired,rejected)"),
    supabase
      .from("candidate_interviews")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("outcome", "pending")
      .gte("scheduled_at", new Date().toISOString()),
  ]);

  return (
    <div className={cardClass}>
      <WidgetHeader icon={BriefcaseIcon} label="Recruitment" />
      <p className={statClass}>
        <AnimatedCount value={openReqs ?? 0} />
      </p>
      <p className="text-[12px] text-ink-soft">Open requisitions</p>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/recruitment" className={`${rowClass} hover:text-primary`}>
          <span>Candidates in pipeline</span>
          <span className="font-bold text-ink">{inPipeline ?? 0}</span>
        </Link>
        <Link href="/recruitment" className={`${rowClass} hover:text-primary`}>
          <span>Upcoming interviews</span>
          <span className="font-bold text-ink">{upcomingInterviews ?? 0}</span>
        </Link>
      </div>
    </div>
  );
}

export async function PerformanceSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: activeCycle } = await supabase
    .from("performance_review_cycles")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ count: goalsInProgress }, { count: appraisalsAwaiting }] = await Promise.all([
    supabase.from("performance_goals").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "in_progress"),
    supabase.from("performance_appraisals").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "submitted"),
  ]);

  return (
    <Link href="/performance" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={TargetIcon} label="Performance management" />
        <p className="mt-1 text-[15px] font-extrabold text-ink">{activeCycle?.name ?? "No active review cycle"}</p>
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          <div className={rowClass}>
            <span>Goals in progress</span>
            <span className="font-bold text-ink">{goalsInProgress ?? 0}</span>
          </div>
          <div className={rowClass}>
            <span>Appraisals awaiting acknowledgement</span>
            <span className="font-bold text-ink">{appraisalsAwaiting ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export async function LearningSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const [{ count: assigned }, { count: completed }, { data: mandatoryCourses }] = await Promise.all([
    supabase.from("training_enrollments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "assigned"),
    supabase.from("training_enrollments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "completed"),
    supabase.from("training_courses").select("id").eq("org_id", orgId).eq("is_mandatory", true),
  ]);

  const mandatoryCourseIds = (mandatoryCourses ?? []).map((c) => c.id);
  const { count: mandatoryOutstanding } =
    mandatoryCourseIds.length > 0
      ? await supabase
          .from("training_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "assigned")
          .in("course_id", mandatoryCourseIds)
      : { count: 0 };

  return (
    <Link href="/learning" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={CapIcon} label="Learning & development" />
        <p className={statClass}>
          <AnimatedCount value={assigned ?? 0} /> in progress
        </p>
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          <div className={rowClass}>
            <span>Mandatory training outstanding</span>
            <span className="font-bold text-ink">{mandatoryOutstanding ?? 0}</span>
          </div>
          <div className={rowClass}>
            <span>Completed</span>
            <span className="font-bold text-ink">{completed ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export async function MyTeamSnapshotWidget({ supabase, orgId, userId }: WidgetProps & { userId: string }) {
  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, department_id, departments(name)")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!myEmployee?.department_id) {
    return (
      <div className={cardClass}>
        <WidgetHeader icon={PeopleIcon} label="My department" />
        <p className="mt-2 text-[13px] text-ink-soft">You aren&apos;t assigned to a department yet.</p>
      </div>
    );
  }

  const [{ count: roster }, { data: departmentEmployees }] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("department_id", myEmployee.department_id).eq("status", "active"),
    supabase.from("employees").select("id").eq("department_id", myEmployee.department_id),
  ]);

  const departmentEmployeeIds = (departmentEmployees ?? []).map((e) => e.id);
  const { count: pendingLeave } =
    departmentEmployeeIds.length > 0
      ? await supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .in("employee_id", departmentEmployeeIds)
      : { count: 0 };

  return (
    <Link href="/team" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={PeopleIcon} label={myEmployee.departments?.name ?? "My department"} />
        <p className={statClass}>
          <AnimatedCount value={roster ?? 0} /> active employees
        </p>
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          <div className={rowClass}>
            <span>Pending leave requests</span>
            <span className="font-bold text-ink">{pendingLeave ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// --- Presentational primitives from the base branch's dashboard redesign
// (KPI tiles, approval donut, monthly cost chart, deadline rail) — kept
// as building blocks and wired into the widget catalog below rather than
// replacing it, so /security/dashboards' per-role visibility controls
// keep covering every widget on the page instead of going stale for some
// of them.

export function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <span className="text-[24px] font-extrabold text-ink">{value}</span>
      <span className="text-[11px] text-ink-soft">{caption}</span>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-primary-tint text-[11px] font-extrabold uppercase tracking-[0.03em] text-primary-dark">
      {initials}
    </div>
  );
}

const DONUT_SEGMENTS: { key: "approved" | "pending" | "rejected"; label: string; colorVar: string }[] = [
  { key: "approved", label: "Approved", colorVar: "var(--good)" },
  { key: "pending", label: "Pending", colorVar: "var(--warn)" },
  { key: "rejected", label: "Rejected", colorVar: "var(--bad)" },
];

export function ApprovalDonut({
  approved,
  pending,
  rejected,
}: {
  approved: number;
  pending: number;
  rejected: number;
}) {
  const total = approved + pending + rejected;
  const counts = { approved, pending, rejected };

  let cursor = 0;
  const stops = DONUT_SEGMENTS.map((segment) => {
    const share = total > 0 ? (counts[segment.key] / total) * 100 : 0;
    const start = cursor;
    cursor += share;
    return `${segment.colorVar} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-[112px] w-[112px] shrink-0 rounded-full"
        style={{ background: total > 0 ? `conic-gradient(${stops})` : "var(--border)" }}
        role="img"
        aria-label={`${approved} approved, ${pending} pending, ${rejected} rejected`}
      >
        <div className="absolute inset-[16px] flex flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-[19px] font-extrabold text-ink">{total}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {DONUT_SEGMENTS.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.colorVar }} aria-hidden="true" />
            <span className="text-ink-soft">{segment.label}</span>
            <span className="font-bold text-ink">{counts[segment.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyPayrollCostChart({ months }: { months: { label: string; totalKobo: Kobo }[] }) {
  const maxKobo = months.reduce((max, m) => (m.totalKobo > max ? m.totalKobo : max), 1n);

  return (
    <div className="flex items-end gap-3 pt-4" style={{ height: 168 }}>
      {months.map((month) => {
        const heightPct = maxKobo > 0n ? Number((month.totalKobo * 1000n) / maxKobo) / 10 : 0;
        return (
          <div key={month.label} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div
              role="img"
              aria-label={`${month.label}: ${formatKobo(month.totalKobo)}`}
              className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-panel border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100"
            >
              {formatKobo(month.totalKobo)}
            </div>
            <div
              className="w-full max-w-[28px] rounded-t-[4px] bg-primary-tint transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(heightPct, month.totalKobo > 0n ? 3 : 1)}%` }}
            />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.02em] text-ink-soft">{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DeadlineItem({ dateLabel, title, authority }: { dateLabel: string; title: string; authority: string }) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-border bg-bg px-3 py-2.5">
      <div className="flex w-11 shrink-0 flex-col items-center rounded-control border border-border bg-surface py-1.5">
        <span className="text-[13px] font-extrabold text-ink">{dateLabel}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        <span className="text-[11px] text-ink-soft">{authority}</span>
      </div>
    </div>
  );
}

// --- Widgets built on top of those primitives, wired into the same
// DASHBOARD_WIDGETS catalog every other widget on this page goes through.

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

// Upcoming statutory filing deadlines plus a TIN-missing gap count — the
// two "am I about to miss something" signals from the compliance/ page
// worth surfacing on the dashboard itself rather than requiring a click
// through. TIN-missing is shown here rather than in WorkforceSnapshotWidget
// since it's a compliance risk (TIN gating, per the statutory reference),
// not a headcount/lifecycle fact.
export async function ComplianceDeadlinesWidget({ supabase, orgId }: WidgetProps) {
  const { count: tinMissingCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active")
    .is("tin", null);

  const rv = NG_2026_1;
  const today = new Date();
  const deadlines = [
    { date: nextMonthlyDeadline(rv.paye.remittance.dueDayOfFollowingMonth, today), title: "PAYE remittance", authority: "State IRS" },
    { date: nextMonthlyDeadline(rv.nsitf.remittance.dueDayOfFollowingMonth, today), title: "NSITF remittance", authority: "NSITF" },
    { date: nextMonthlyDeadline(rv.wht.remittance.dueDayOfFollowingMonth, today), title: "WHT & VAT remittance", authority: "NRS / FIRS" },
    { date: nextAnnualDeadline(rv.itf.remittance.dueAnnuallyOn, today), title: "ITF annual filing", authority: "ITF" },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <Link href="/compliance" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={CalendarIcon} label="Upcoming filings" />
        {(tinMissingCount ?? 0) > 0 && (
          <div className={`${rowClass} mt-1`}>
            <span>Active employees missing a TIN</span>
            <span className="font-bold text-bad">{tinMissingCount}</span>
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
          {deadlines.map((deadline) => (
            <div key={deadline.title} className="flex items-start gap-3 rounded-panel border border-border bg-bg px-3 py-2.5">
              <div className="flex w-11 shrink-0 flex-col items-center rounded-control border border-border bg-surface py-1.5">
                <span className="text-[13px] font-extrabold text-ink">{formatDeadlineDate(deadline.date)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-bold text-ink">{deadline.title}</span>
                <span className="text-[11px] text-ink-soft">{deadline.authority}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export async function OrgKpiSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10);

  const [{ count: activeEmployeeCount }, { count: newHireCount }, { count: tinMissingCount }, ...approvalTableRows] =
    await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "active")
        .gte("hire_date", thirtyDaysAgoIso),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "active")
        .is("tin", null),
      ...APPROVAL_TABLES.map((table) => supabase.from(table).select("status").eq("org_id", orgId)),
    ]);

  let pendingCount = 0;
  for (const result of approvalTableRows) {
    for (const row of result.data ?? []) {
      if (row.status === "pending") pendingCount++;
    }
  }

  return (
    <div className={cardClass}>
      <WidgetHeader icon={PeopleIcon} label="Organization KPIs" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatTile label="Total Employees" value={String(activeEmployeeCount ?? 0)} caption="Active headcount" />
        <StatTile label="New Hires" value={String(newHireCount ?? 0)} caption="In the last 30 days" />
        <StatTile label="Pending Approvals" value={String(pendingCount)} caption="Loans, expenses, overtime & leave" />
        <StatTile
          label="TIN Missing"
          value={String(tinMissingCount ?? 0)}
          caption={`Of ${activeEmployeeCount ?? 0} active employees`}
        />
      </div>
    </div>
  );
}

export async function ApprovalsBreakdownWidget({ supabase, orgId }: WidgetProps) {
  const approvalTableRows = await Promise.all(
    APPROVAL_TABLES.map((table) => supabase.from(table).select("status").eq("org_id", orgId)),
  );

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

  return (
    <div className={cardClass}>
      <WidgetHeader icon={ClockIcon} label="Approvals breakdown" />
      <div className="mt-3">
        <ApprovalDonut approved={approvedCount} pending={pendingCount} rejected={rejectedCount} />
      </div>
    </div>
  );
}

export async function PayrollCostTrendWidget({ supabase, orgId }: WidgetProps) {
  const today = new Date();
  const { data: payRunsForChart } = await supabase
    .from("pay_runs")
    .select("period_end, net_kobo, status")
    .eq("org_id", orgId)
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

  return (
    <Link href="/payroll" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <WidgetHeader icon={BanknoteIcon} label="Payroll cost trend" />
        <p className="mt-1 text-[13px] text-ink-soft">Net pay, last 6 months</p>
        <MonthlyPayrollCostChart months={chartMonths} />
      </div>
    </Link>
  );
}

export async function RecentPayRunsWidget({ supabase, orgId }: WidgetProps) {
  const { data: recentPayRuns } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, frequency, status, net_kobo")
    .eq("org_id", orgId)
    .order("period_end", { ascending: false })
    .limit(5);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <WidgetHeader icon={BanknoteIcon} label="Recent pay runs" />
        <Link href="/payroll" className="text-[12px] font-bold text-primary">
          See all
        </Link>
      </div>
      <div className="mt-3 flex flex-col">
        {recentPayRuns && recentPayRuns.length > 0 ? (
          recentPayRuns.map((run) => (
            <Link
              key={run.id}
              href={`/payroll/${run.id}`}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-[13px] last:border-b-0 hover:text-primary"
            >
              <span className="font-bold text-ink">
                {run.period_start} – {run.period_end}
              </span>
              <PayRunStatusBadge status={run.status} />
              <span className="font-bold text-ink">{formatKobo(BigInt(run.net_kobo))}</span>
            </Link>
          ))
        ) : (
          <p className="py-4 text-center text-[13px] text-ink-soft">No pay runs yet.</p>
        )}
      </div>
    </div>
  );
}

export async function EmployeeDirectoryWidget({ supabase, orgId }: WidgetProps) {
  const { data: recentEmployees } = await supabase
    .from("employees_masked")
    .select("id, full_name, email, department_name")
    .eq("org_id", orgId)
    .order("full_name")
    .limit(6);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <WidgetHeader icon={PeopleIcon} label="Employee directory" />
        <Link href="/employees" className="text-[12px] font-bold text-primary">
          See all
        </Link>
      </div>
      <div className="mt-3 flex flex-col">
        {recentEmployees && recentEmployees.length > 0 ? (
          recentEmployees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-[13px] last:border-b-0">
              <div className="flex items-center gap-3">
                <Avatar name={employee.full_name ?? "?"} />
                <div className="flex flex-col">
                  <span className="font-bold text-ink">{employee.full_name ?? "—"}</span>
                  <span className="text-[12px] text-ink-soft">{employee.email ?? "—"}</span>
                </div>
              </div>
              <span className="text-ink-soft">{employee.department_name ?? "—"}</span>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-[13px] text-ink-soft">No employees yet.</p>
        )}
      </div>
    </div>
  );
}
