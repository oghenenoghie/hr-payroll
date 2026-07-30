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

export default async function LeavePage() {
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

  const { data: leaveRequests } = await supabase
    .from("leave_requests")
    .select("*, employees(full_name, annual_leave_balance_days)")
    .order("created_at", { ascending: false });

  const pending = (leaveRequests ?? []).filter((l) => l.status === "pending");
  const rest = (leaveRequests ?? []).filter((l) => l.status !== "pending");

  // Only ever non-empty for admin/payroll_manager viewers — the RLS policy
  // restricts visibility the same way loans/expenses/overtime approvals do,
  // since encashment converts leave into money.
  const { data: encashmentRequests } = await supabase
    .from("leave_encashment_requests")
    .select("*, employees(full_name, annual_leave_balance_days)")
    .order("created_at", { ascending: false });

  const pendingEncashments = (encashmentRequests ?? []).filter((r) => r.status === "pending");
  const restEncashments = (encashmentRequests ?? []).filter((r) => r.status !== "pending");

  const leaveCsv = toCsv(
    ["Employee", "Type", "Start Date", "End Date", "Days", "Status"],
    (leaveRequests ?? []).map((leave) => [
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
    (encashmentRequests ?? []).map((request) => [request.employees?.full_name ?? "—", request.days_requested, request.status]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave &amp; Attendance</span>
          {leaveRequests && leaveRequests.length > 0 && <ExportCsvButton csv={leaveCsv} filename="leave-requests.csv" />}
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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All requests</span>
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
                    No leave requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <header className="flex flex-col gap-1 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave Encashment</span>
          {encashmentRequests && encashmentRequests.length > 0 && (
            <ExportCsvButton csv={encashmentCsv} filename="leave-encashments.csv" />
          )}
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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All encashment requests</span>
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
                    No leave encashment requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
