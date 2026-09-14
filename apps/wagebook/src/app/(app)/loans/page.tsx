import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { toCsv } from "@/lib/csv";
import { toNaira } from "@plutus/compliance";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PendingLoansTable } from "./PendingLoansTable";
import { SettledLoansTable } from "./SettledLoansTable";

const PAGE_SIZE = 25;

type PendingLoan = {
  id: string;
  principal_kobo: number;
  monthly_repayment_kobo: number;
  reason: string | null;
  status: string;
  created_at: string;
  employees: { full_name: string } | null;
};

type SettledLoan = {
  id: string;
  principal_kobo: number;
  outstanding_kobo: number;
  monthly_repayment_kobo: number;
  reason: string | null;
  status: string;
  employees: { full_name: string } | null;
};

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
      .select("id, principal_kobo, monthly_repayment_kobo, reason, status, created_at, employees(full_name)")
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
          <PendingLoansTable pending={pending} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
        <SettledLoansTable loans={rest} />
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
