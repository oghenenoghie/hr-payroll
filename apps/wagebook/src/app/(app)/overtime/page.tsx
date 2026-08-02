import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { OvertimeStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { approveOvertime, rejectOvertime } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Pending is an actionable work queue — stays unbounded (naturally
  // small, capped by how many requests are actually awaiting a decision
  // at once). Only the settled history (approved/rejected) grows without
  // bound over the org's lifetime, so that's the part that's paginated.
  const [{ data: pendingRaw }, { data: restRaw, count }] = await Promise.all([
    supabase
      .from("overtime_requests")
      .select("id, work_date, hours, reason, status, employees(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("overtime_requests")
      .select("id, work_date, hours, reason, rate_multiplier_bps, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
  ]);

  const pending = pendingRaw ?? [];
  const rest = restRaw ?? [];

  const totalRest = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRest / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/overtime?page=${page}`;
  }

  const csv = toCsv(
    ["Employee", "Date", "Hours", "Reason", "Rate", "Status"],
    [
      ...pending.map((request) => ({ ...request, rate_multiplier_bps: null as number | null })),
      ...rest,
    ].map((request) => [
      request.employees?.full_name ?? "—",
      request.work_date,
      Number(request.hours),
      request.reason ?? "",
      request.status === "rejected" || request.status === "pending" || request.rate_multiplier_bps === null
        ? ""
        : `${request.rate_multiplier_bps / 100}x`,
      request.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overtime Management</span>
          <ExportCsvButton csv={csv} filename="overtime-requests.csv" label="Export this page (CSV)" />
        </div>
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
                        <ConfirmActionButton
                          action={approveOvertime.bind(null, request.id, 150)}
                          label="Approve · 1.5×"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve at 1.5× rate?"
                          confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be approved at 1.5× and paid out in the next pay run.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={approveOvertime.bind(null, request.id, 200)}
                          label="Approve · 2×"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve at 2× rate?"
                          confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be approved at 2× and paid out in the next pay run.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={rejectOvertime.bind(null, request.id)}
                          label="Reject"
                          confirmTitle="Reject this overtime request?"
                          confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be rejected.`}
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
                    No overtime history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} request{totalRest === 1 ? "" : "s"} total
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
    </div>
  );
}
