import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { LeaveStatusBadge } from "@/components/Badge";
import { approveLeave, rejectLeave } from "./actions";

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

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave &amp; Attendance</span>
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
                        <form action={approveLeave.bind(null, leave.id)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve
                          </button>
                        </form>
                        <form action={rejectLeave.bind(null, leave.id)}>
                          <button type="submit" className="text-[12px] font-bold text-bad">
                            Reject
                          </button>
                        </form>
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
    </div>
  );
}
