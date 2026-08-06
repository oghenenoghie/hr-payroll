import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { LeaveStatusBadge, LeaveEncashmentStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { approveLeave, rejectLeave, approveLeaveEncashment, rejectLeaveEncashment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; encashment_page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { page: pageParam, encashment_page: encashmentPageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);
  const requestedEncashmentPage = Math.max(1, Number(encashmentPageParam) || 1);

  // Pending is an actionable work queue — every request needs to stay
  // visible, so that fetch is unbounded (naturally small, capped by how
  // many requests are actually awaiting a decision at once). Only the
  // settled history (approved/rejected) grows without bound over the
  // org's lifetime, so that's the part that's paginated.
  const [
    { data: pendingRaw },
    { data: restRaw, count: restCount },
    { data: pendingEncashmentsRaw },
    { data: restEncashmentsRaw, count: restEncashmentsCount },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, status, employees(full_name, annual_leave_balance_days)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
    // Only ever non-empty for admin/payroll_manager viewers — the RLS policy
    // restricts visibility the same way loans/expenses/overtime approvals do,
    // since encashment converts leave into money.
    supabase
      .from("leave_encashment_requests")
      .select("id, days_requested, status, employees(full_name, annual_leave_balance_days)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("leave_encashment_requests")
      .select("id, days_requested, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedEncashmentPage - 1) * PAGE_SIZE, requestedEncashmentPage * PAGE_SIZE - 1),
  ]);

  const pending = pendingRaw ?? [];
  const rest = restRaw ?? [];
  const pendingEncashments = pendingEncashmentsRaw ?? [];
  const restEncashments = restEncashmentsRaw ?? [];

  const totalRest = restCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRest / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const totalRestEncashments = restEncashmentsCount ?? 0;
  const totalEncashmentPages = Math.max(1, Math.ceil(totalRestEncashments / PAGE_SIZE));
  const currentEncashmentPage = Math.min(requestedEncashmentPage, totalEncashmentPages);

  function pageHref(page: number): string {
    return `/leave?page=${page}${requestedEncashmentPage > 1 ? `&encashment_page=${requestedEncashmentPage}` : ""}`;
  }

  function encashmentPageHref(page: number): string {
    return `/leave?encashment_page=${page}${requestedPage > 1 ? `&page=${requestedPage}` : ""}`;
  }

  // Scoped to what's actually on screen — the pending queue plus this
  // page of settled history — never a separate full-history re-query.
  const leaveCsv = toCsv(
    ["Employee", "Type", "Start Date", "End Date", "Days", "Status"],
    [...pending, ...rest].map((leave) => [
      leave.employees?.full_name ?? "—",
      leave.leave_type,
      leave.start_date,
      leave.end_date,
      leave.days,
      leave.status,
    ]),
  );

  const encashmentCsv = toCsv(
    ["Employee", "Days Requested", "Status"],
    [...pendingEncashments, ...restEncashments].map((request) => [
      request.employees?.full_name ?? "—",
      request.days_requested,
      request.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave &amp; Attendance</span>
          <ExportCsvButton csv={leaveCsv} filename="leave-requests.csv" label="Export this page (CSV)" />
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Policies, balances and approvals tied to payroll</h1>
        <p className="text-[13px] text-ink-soft">
          Approving annual leave decrements the employee&apos;s balance immediately. Unpaid leave is deducted from
          gross pay — and re-taxed — through the next pay run.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-left`}>Type</th>
                  <th className={`${thClass} text-left`}>Dates</th>
                  <th className={`${thClass} text-right`}>Days</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((leave) => (
                  <tr key={leave.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{leave.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft capitalize`}>{leave.leave_type}</td>
                    <td className={`${tdClass} text-ink-soft`}>
                      {leave.start_date} – {leave.end_date}
                    </td>
                    <td className={`${tdClass} text-right text-ink`}>{leave.days}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {leave.employees ? Number(leave.employees.annual_leave_balance_days) : "—"}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <ConfirmActionButton
                          action={approveLeave.bind(null, leave.id)}
                          label="Approve"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve this leave request?"
                          confirmMessage={`${leave.employees?.full_name ?? "This employee"}'s ${leave.leave_type} leave (${leave.start_date} – ${leave.end_date}, ${leave.days} day${leave.days === 1 ? "" : "s"}) will be approved and their balance updated immediately.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={rejectLeave.bind(null, leave.id)}
                          label="Reject"
                          confirmTitle="Reject this leave request?"
                          confirmMessage={`${leave.employees?.full_name ?? "This employee"}'s ${leave.leave_type} leave (${leave.start_date} – ${leave.end_date}) will be rejected.`}
                          confirmLabel="Reject"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-left`}>Type</th>
                <th className={`${thClass} text-left`}>Dates</th>
                <th className={`${thClass} text-right`}>Days</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((leave) => (
                  <tr key={leave.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{leave.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft capitalize`}>{leave.leave_type}</td>
                    <td className={`${tdClass} text-ink-soft`}>
                      {leave.start_date} – {leave.end_date}
                    </td>
                    <td className={`${tdClass} text-right text-ink`}>{leave.days}</td>
                    <td className={`${tdClass} text-center`}>
                      <LeaveStatusBadge status={leave.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No leave history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} record{totalRest === 1 ? "" : "s"} total
            </span>
            <div className="flex gap-3">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                  ← Previous
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
              )}
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                  Next →
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>

      <header className="flex flex-col gap-1 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave Encashment</span>
          <ExportCsvButton csv={encashmentCsv} filename="leave-encashments.csv" label="Export this page (CSV)" />
        </div>
        <p className="text-[13px] text-ink-soft">
          Cashing out unused annual leave for money while still employed. Approving decrements the balance
          immediately and atomically rejects if it&apos;s insufficient — the payout itself is taxable and goes out
          through the next pay run.
        </p>
      </header>

      {pendingEncashments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-right`}>Days requested</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pendingEncashments.map((request) => (
                  <tr key={request.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{request.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{request.days_requested}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {request.employees ? Number(request.employees.annual_leave_balance_days) : "—"}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <ConfirmActionButton
                          action={approveLeaveEncashment.bind(null, request.id)}
                          label="Approve"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve this leave encashment?"
                          confirmMessage={`${request.employees?.full_name ?? "This employee"}'s request to cash out ${request.days_requested} day${request.days_requested === 1 ? "" : "s"} will be approved. Their balance is decremented immediately, and the taxable payout goes out with the next pay run.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={rejectLeaveEncashment.bind(null, request.id)}
                          label="Reject"
                          confirmTitle="Reject this leave encashment?"
                          confirmMessage={`${request.employees?.full_name ?? "This employee"}'s request to cash out ${request.days_requested} day${request.days_requested === 1 ? "" : "s"} will be rejected.`}
                          confirmLabel="Reject"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Encashment history</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-right`}>Days</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {restEncashments.length > 0 ? (
                restEncashments.map((request) => (
                  <tr key={request.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{request.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{request.days_requested}</td>
                    <td className={`${tdClass} text-center`}>
                      <LeaveEncashmentStatusBadge status={request.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No leave encashment history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalEncashmentPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentEncashmentPage} of {totalEncashmentPages} · {totalRestEncashments} record
              {totalRestEncashments === 1 ? "" : "s"} total
            </span>
            <div className="flex gap-3">
              {currentEncashmentPage > 1 ? (
                <Link href={encashmentPageHref(currentEncashmentPage - 1)} className="text-[12.5px] font-bold text-primary">
                  ← Previous
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
              )}
              {currentEncashmentPage < totalEncashmentPages ? (
                <Link href={encashmentPageHref(currentEncashmentPage + 1)} className="text-[12.5px] font-bold text-primary">
                  Next →
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
