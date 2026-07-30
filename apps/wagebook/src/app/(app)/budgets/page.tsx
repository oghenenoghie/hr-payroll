import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { BudgetForm } from "./BudgetForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BudgetsPage() {
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
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "accountant")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const { data: budgets } = await supabase.from("budgets").select("*").order("period_start", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
        <h1 className="text-[22px] font-extrabold text-ink">Budgets</h1>
        <p className="text-[13px] text-ink-soft">
          Planned vs. actual, by revenue and expense account, for a date range. Actuals are pulled live from the
          general ledger — there&apos;s nothing to keep in sync by hand. One target amount per account for the whole
          period; no monthly breakdown yet.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Budget</th>
              <th className={`${thClass} text-left`}>Period</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {budgets && budgets.length > 0 ? (
              budgets.map((budget) => (
                <tr key={budget.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{budget.name}</td>
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
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No budgets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
