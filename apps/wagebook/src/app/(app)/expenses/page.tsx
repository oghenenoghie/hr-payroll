import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PendingExpensesTable } from "./PendingExpensesTable";
import { SettledExpensesTable } from "./SettledExpensesTable";

const PAGE_SIZE = 25;

type PendingExpense = {
  id: string;
  amount_kobo: number;
  description: string;
  taxable: boolean | null;
  status: string;
  created_at: string;
  employees: { full_name: string } | null;
};

type SettledExpense = {
  id: string;
  amount_kobo: number;
  description: string;
  taxable: boolean | null;
  status: string;
  employees: { full_name: string } | null;
};

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
  // small, capped by how many claims are actually awaiting a decision at
  // once). Only the settled history (approved/rejected) grows without
  // bound over the org's lifetime, so that's the part that's paginated.
  const [{ data: pendingRaw }, { data: restRaw, count }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount_kobo, description, taxable, status, created_at, employees(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, amount_kobo, description, taxable, status, employees(full_name)", { count: "exact" })
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
    return `/expenses?page=${page}`;
  }

  const csv = toCsv(
    ["Employee", "Amount (NGN)", "Description", "Tax Treatment", "Status"],
    [...pending, ...rest].map((expense) => [
      expense.employees?.full_name ?? "—",
      toNaira(BigInt(expense.amount_kobo)).toFixed(2),
      expense.description,
      expense.taxable === null ? "" : expense.taxable ? "Taxable" : "Non-taxable",
      expense.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Expense Reimbursement</span>
          <ExportCsvButton csv={csv} filename="expense-claims.csv" label="Export this page (CSV)" />
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Claims, approvals and taxable/non-taxable handling</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a claim decides its tax treatment — taxable claims are added to chargeable income and re-taxed
          in the next pay run; non-taxable claims are paid out as pure cash.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending claims</span>
          <PendingExpensesTable pending={pending} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
        <SettledExpensesTable expenses={rest} />
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} claim{totalRest === 1 ? "" : "s"} total
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
