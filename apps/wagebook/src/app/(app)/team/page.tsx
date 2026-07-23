import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { TinBadge } from "@/components/Badge";
import { approveLeave, rejectLeave } from "../leave/actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: myEmployee } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();

  const { data: reports } = myEmployee
    ? await supabase.from("employees").select("*").eq("manager_id", myEmployee.id).order("full_name")
    : { data: null };

  const reportIds = (reports ?? []).map((r) => r.id);

  const { data: pendingLeave } =
    reportIds.length > 0
      ? await supabase
          .from("leave_requests")
          .select("*, employees(full_name)")
          .in("employee_id", reportIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Manager View</span>
        <h1 className="text-[22px] font-extrabold text-ink">Team overview and approvals in one place</h1>
      </header>

      {!reports || reports.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
          You don&apos;t manage any employees yet.
        </div>
      ) : (
        <>
          {pendingLeave && pendingLeave.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                Pending leave requests
              </span>
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${thClass} text-left`}>Employee</th>
                      <th className={`${thClass} text-left`}>Type</th>
                      <th className={`${thClass} text-left`}>Dates</th>
                      <th className={`${thClass} text-right`}>Days</th>
                      <th className={thClass}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeave.map((leave) => (
                      <tr key={leave.id} className="border-b border-border last:border-b-0">
                        <td className={`${tdClass} font-bold text-ink`}>{leave.employees?.full_name ?? "—"}</td>
                        <td className={`${tdClass} text-ink-soft capitalize`}>{leave.leave_type}</td>
                        <td className={`${tdClass} text-ink-soft`}>
                          {leave.start_date} – {leave.end_date}
                        </td>
                        <td className={`${tdClass} text-right text-ink`}>{leave.days}</td>
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
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Your team</span>
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${thClass} text-left`}>Name</th>
                    <th className={`${thClass} text-left`}>State</th>
                    <th className={`${thClass} text-right`}>Basic</th>
                    <th className={`${thClass} text-center`}>TIN</th>
                    <th className={`${thClass} text-right`}>Leave balance</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>{report.full_name}</td>
                      <td className={`${tdClass} text-ink-soft`}>{report.state_of_residence ?? "—"}</td>
                      <td className={`${tdClass} text-right font-bold text-ink`}>
                        {formatKobo(BigInt(report.basic_kobo))}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        <TinBadge tin={report.tin} />
                      </td>
                      <td className={`${tdClass} text-right text-ink-soft`}>
                        {Number(report.annual_leave_balance_days)} days
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
