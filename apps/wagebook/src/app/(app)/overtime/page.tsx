import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { OvertimeStatusBadge } from "@/components/Badge";
import { approveOvertime, rejectOvertime } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function OvertimePage() {
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

  const { data: requests } = await supabase
    .from("overtime_requests")
    .select("*, employees(full_name)")
    .order("created_at", { ascending: false });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const rest = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overtime Management</span>
        <h1 className="text-[22px] font-extrabold text-ink">Requests, approvals and pay rate</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a request sets its pay rate — 1.5× is the standard weekday multiplier; 2× is available for
          holiday or premium overtime. An approved request is paid out in the next pay run.
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
                  <th className={`${thClass} text-left`}>Date</th>
                  <th className={`${thClass} text-right`}>Hours</th>
                  <th className={`${thClass} text-left`}>Reason</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((request) => (
                  <tr key={request.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{request.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{request.work_date}</td>
                    <td className={`${tdClass} text-right text-ink`}>{Number(request.hours)}</td>
                    <td className={`${tdClass} text-ink-soft`}>{request.reason ?? "—"}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <form action={approveOvertime.bind(null, request.id, 150)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve · 1.5×
                          </button>
                        </form>
                        <form action={approveOvertime.bind(null, request.id, 200)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve · 2×
                          </button>
                        </form>
                        <form action={rejectOvertime.bind(null, request.id)}>
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
                <th className={`${thClass} text-left`}>Date</th>
                <th className={`${thClass} text-right`}>Hours</th>
                <th className={`${thClass} text-right`}>Rate</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((request) => (
                  <tr key={request.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{request.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{request.work_date}</td>
                    <td className={`${tdClass} text-right text-ink`}>{Number(request.hours)}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {request.status === "rejected" ? "—" : `${request.rate_multiplier_bps / 100}×`}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <OvertimeStatusBadge status={request.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No overtime requests yet.
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
