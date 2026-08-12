import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { BudgetForm } from "./BudgetForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

const BUDGET_TYPE_LABEL: Record<string, string> = {
  operating: "Operating",
  capital: "Capital",
  cash: "Cash",
};

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    !membership ||
    (membership.role !== "admin" &&
      membership.role !== "payroll_manager" &&
      membership.role !== "accountant" &&
      membership.role !== "auditor" &&
      membership.role !== "finance_manager")
  ) {
    redirect("/dashboard");
  }

  const canManage =
    membership.role === "admin" || membership.role === "payroll_manager" || membership.role === "finance_manager";

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const {
    data: budgets,
    count,
  } = await supabase
    .from("budgets")
    .select("id, name, period_start, period_end, budget_type", { count: "exact" })
    .order("period_start", { ascending: false })
    .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1);

  const totalBudgets = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalBudgets / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/budgets?page=${page}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
        <h1 className="text-[22px] font-extrabold text-ink">Budgets</h1>
        <p className="text-[13px] text-ink-soft">
          Planned vs. actual, for a date range. Operating budgets cover revenue and expense accounts; capital
          budgets cover planned asset spend; cash budgets cover planned obligations and cash position. Actuals are
          pulled live from the general ledger — there&apos;s nothing to keep in sync by hand. A budget line can
          cover the whole period as one figure, or be broken into months/quarters by adding one line per sub-period.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Budget</th>
              <th className={`${thClass} text-left`}>Type</th>
              <th className={`${thClass} text-left`}>Period</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {budgets && budgets.length > 0 ? (
              budgets.map((budget) => (
                <tr key={budget.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{budget.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>{BUDGET_TYPE_LABEL[budget.budget_type] ?? budget.budget_type}</td>
                  <td className={`${tdClass} text-ink-soft`}>
                    {budget.period_start} – {budget.period_end}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/budgets/${budget.id}`} className="text-[12px] font-bold text-primary">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No budgets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-soft">
            Page {currentPage} of {totalPages} · {totalBudgets} budget{totalBudgets === 1 ? "" : "s"} total
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

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Create a budget</span>
          <div className="mt-3">
            <BudgetForm />
          </div>
        </div>
      )}
    </div>
  );
}
