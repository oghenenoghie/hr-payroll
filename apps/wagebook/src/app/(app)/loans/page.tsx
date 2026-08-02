import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { LoanStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { toNaira } from "@plutus/compliance";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { approveLoan, rejectLoan } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
  // small, capped by how many loans are actually awaiting a decision at
  // once). Only the settled history (approved/rejected) grows without
  // bound over the org's lifetime, so that's the part that's paginated.
  const [{ data: pendingRaw }, { data: restRaw, count }] = await Promise.all([
    supabase
      .from("loans")
      .select("id, principal_kobo, monthly_repayment_kobo, reason, status, employees(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("loans")
      .select("id, principal_kobo, outstanding_kobo, monthly_repayment_kobo, reason, status, employees(full_name)", {
        count: "exact",
      })
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
    return `/loans?page=${page}`;
  }

  const csv = toCsv(
    ["Employee", "Principal (NGN)", "Monthly Repayment (NGN)", "Reason", "Status"],
    [...pending, ...rest].map((loan) => [
      loan.employees?.full_name ?? "—",
      toNaira(BigInt(loan.principal_kobo)).toFixed(2),
      toNaira(BigInt(loan.monthly_repayment_kobo)).toFixed(2),
      loan.reason ?? "",
      loan.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Loans &amp; Advances</span>
          <ExportCsvButton csv={csv} filename="loans.csv" label="Export this page (CSV)" />
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Requests, repayment schedules and payroll deductions</h1>
        <p className="text-[13px] text-ink-soft">
          Approved loans are deducted automatically from net pay in every pay run until fully repaid.
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
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-right`}>Monthly repayment</th>
                  <th className={`${thClass} text-left`}>Reason</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{loan.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(loan.principal_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.monthly_repayment_kobo))}
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{loan.reason ?? "—"}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <ConfirmActionButton
                          action={approveLoan.bind(null, loan.id)}
                          label="Approve"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve this loan?"
                          confirmMessage={`${loan.employees?.full_name ?? "This employee"}'s loan of ${formatKobo(BigInt(loan.principal_kobo))} will be approved, with ${formatKobo(BigInt(loan.monthly_repayment_kobo))} deducted from net pay each run until fully repaid.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={rejectLoan.bind(null, loan.id)}
                          label="Reject"
                          confirmTitle="Reject this loan?"
                          confirmMessage={`${loan.employees?.full_name ?? "This employee"}'s loan request will be rejected.`}
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
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>Outstanding</th>
                <th className={`${thClass} text-right`}>Monthly repayment</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{loan.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(loan.principal_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.outstanding_kobo))}
                    </td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.monthly_repayment_kobo))}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <LoanStatusBadge status={loan.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No loan history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} loan{totalRest === 1 ? "" : "s"} total
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
