import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";
import { formatKobo } from "@/lib/format";

type WidgetProps = { supabase: SupabaseClient<Database>; orgId: string };

const cardClass = "rounded-card border border-border bg-surface p-6";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const statClass = "mt-1 text-[22px] font-extrabold text-ink";
const rowClass = "flex items-center justify-between gap-3 text-[13px]";

export async function OrgSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: org } = await supabase
    .from("organizations")
    .select("name, default_pay_frequency, states_of_operation")
    .eq("id", orgId)
    .maybeSingle();

  return (
    <div className={cardClass}>
      <span className={labelClass}>Organization</span>
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

  return (
    <div className={cardClass}>
      <span className={labelClass}>Pending approvals</span>
      <p className={statClass}>{total}</p>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/leave" className={`${rowClass} hover:text-primary`}>
          <span>Leave</span>
          <span className="font-bold text-ink">{leave ?? 0}</span>
        </Link>
        <Link href="/loans" className={`${rowClass} hover:text-primary`}>
          <span>Loans</span>
          <span className="font-bold text-ink">{loans ?? 0}</span>
        </Link>
        <Link href="/expenses" className={`${rowClass} hover:text-primary`}>
          <span>Expenses</span>
          <span className="font-bold text-ink">{expenses ?? 0}</span>
        </Link>
        <Link href="/overtime" className={`${rowClass} hover:text-primary`}>
          <span>Overtime</span>
          <span className="font-bold text-ink">{overtime ?? 0}</span>
        </Link>
      </div>
    </div>
  );
}

export async function PayrollSnapshotWidget({ supabase, orgId }: WidgetProps) {
  const { data: latestRun } = await supabase
    .from("pay_runs")
    .select("period_start, period_end, status, gross_kobo, net_kobo, employee_count")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Link href="/payroll" className="block transition-opacity hover:opacity-80">
      <div className={cardClass}>
        <span className={labelClass}>Most recent pay run</span>
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
        <span className={labelClass}>Active employees</span>
        <p className={statClass}>{active ?? 0}</p>
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
        <span className={labelClass}>Recent authentication activity</span>
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

  return (
    <div className={cardClass}>
      <span className={labelClass}>Accounts payable &amp; receivable</span>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/bills" className={`${rowClass} hover:text-primary`}>
          <span>Bills awaiting payment</span>
          <span className="font-bold text-ink">{outstandingBills ?? 0}</span>
        </Link>
        <Link href="/invoices" className={`${rowClass} hover:text-primary`}>
          <span>Invoices awaiting collection</span>
          <span className="font-bold text-ink">{outstandingInvoices ?? 0}</span>
        </Link>
      </div>
    </div>
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
        <span className={labelClass}>Budgets</span>
        <p className={statClass}>{activeCount ?? 0}</p>
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
      <span className={labelClass}>Compensation &amp; benefits</span>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/job-grades" className={`${rowClass} hover:text-primary`}>
          <span>Job grades</span>
          <span className="font-bold text-ink">{grades ?? 0}</span>
        </Link>
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
      <span className={labelClass}>Recruitment</span>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-soft">
        <Link href="/recruitment" className={`${rowClass} hover:text-primary`}>
          <span>Open requisitions</span>
          <span className="font-bold text-ink">{openReqs ?? 0}</span>
        </Link>
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
        <span className={labelClass}>Performance management</span>
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
        <span className={labelClass}>Learning &amp; development</span>
        <p className={statClass}>{assigned ?? 0} in progress</p>
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
        <span className={labelClass}>My department</span>
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
        <span className={labelClass}>{myEmployee.departments?.name ?? "My department"}</span>
        <p className={statClass}>{roster ?? 0} active employees</p>
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

