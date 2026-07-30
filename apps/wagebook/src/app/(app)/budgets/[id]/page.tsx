import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";
import { BudgetLineForm } from "./BudgetLineForm";
import { deleteBudgetLine, deleteBudget } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: budgetRow } = await supabase.from("budgets").select("*").eq("id", id).single();
  if (!budgetRow) notFound();
  const budget = budgetRow;

  const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, type");
  const accountByCode = new Map((accounts ?? []).map((account) => [account.code, account]));
  const accountLabel = (code: string) => accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;
  const revenueExpenseAccounts = (accounts ?? []).filter((a) => a.type === "revenue" || a.type === "expense");

  const { data: lines } = await supabase.from("budget_lines").select("*").eq("budget_id", id);
  const budgetLines = lines ?? [];
  const budgetedCodes = new Set(budgetLines.map((l) => l.account_code));

  // Same signed-sum logic as Profit & Loss: revenue is credit-normal,
  // expense debit-normal — actuals here are pulled live, never stored.
  const { data: journalEntries } = await supabase
    .from("journal_entries")
    .select("id")
    .gte("entry_date", budget.period_start)
    .lte("entry_date", budget.period_end);
  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);

  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("account_code, direction, amount_kobo")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };

  const actualByCode = new Map<string, bigint>();
  for (const posting of postings ?? []) {
    const type = accountByCode.get(posting.account_code)?.type;
    if (type !== "revenue" && type !== "expense") continue;
    const signedAmount = posting.direction === "credit" ? BigInt(posting.amount_kobo) : -BigInt(posting.amount_kobo);
    const current = actualByCode.get(posting.account_code) ?? 0n;
    actualByCode.set(posting.account_code, type === "revenue" ? current + signedAmount : current - signedAmount);
  }

  const revenueLines = budgetLines.filter((l) => accountByCode.get(l.account_code)?.type === "revenue");
  const expenseLines = budgetLines.filter((l) => accountByCode.get(l.account_code)?.type === "expense");

  const totalBudgetedRevenue = revenueLines.reduce((sum, l) => sum + BigInt(l.amount_kobo), 0n);
  const totalBudgetedExpense = expenseLines.reduce((sum, l) => sum + BigInt(l.amount_kobo), 0n);
  const totalActualRevenue = revenueLines.reduce((sum, l) => sum + (actualByCode.get(l.account_code) ?? 0n), 0n);
  const totalActualExpense = expenseLines.reduce((sum, l) => sum + (actualByCode.get(l.account_code) ?? 0n), 0n);

  const unbudgetedActuals = [...actualByCode.entries()].filter(([code, amount]) => !budgetedCodes.has(code) && amount !== 0n);

  function renderRows(rows: typeof budgetLines, type: "revenue" | "expense") {
    return rows.map((line) => {
      const budgeted = BigInt(line.amount_kobo);
      const actual = actualByCode.get(line.account_code) ?? 0n;
      const variance = actual - budgeted;
      const favorable = type === "revenue" ? variance >= 0n : variance <= 0n;
      const pctOfBudget = budgeted > 0n ? Number((actual * 100n) / budgeted) : 0;
      return (
        <tr key={line.id} className="border-b border-border last:border-b-0">
          <td className={`${tdClass} text-ink`}>{accountLabel(line.account_code)}</td>
          <td className={`${tdClass} text-right text-ink`}>{formatKobo(budgeted)}</td>
          <td className={`${tdClass} text-right text-ink`}>{formatKobo(actual)}</td>
          <td className={`${tdClass} text-right font-bold ${favorable ? "text-good" : "text-bad"}`}>
            {formatKobo(variance < 0n ? -variance : variance)} {favorable ? "under" : "over"}
          </td>
          <td className={`${tdClass} text-right text-ink-soft`}>{pctOfBudget}%</td>
          {canManage && (
            <td className={`${tdClass} text-right`}>
              <form action={deleteBudgetLine.bind(null, line.id, budget.id)}>
                <button type="submit" className="text-[12px] font-bold text-bad">
                  Delete
                </button>
              </form>
            </td>
          )}
        </tr>
      );
    });
  }

  const csv = toCsv(
    ["Section", "Account", "Budgeted (NGN)", "Actual (NGN)", "Variance (NGN)", "% of budget"],
    [
      ...revenueLines.map((line) => {
        const budgeted = BigInt(line.amount_kobo);
        const actual = actualByCode.get(line.account_code) ?? 0n;
        const pct = budgeted > 0n ? Number((actual * 100n) / budgeted) : 0;
        return ["Revenue", accountLabel(line.account_code), toNaira(budgeted).toFixed(2), toNaira(actual).toFixed(2), toNaira(actual - budgeted).toFixed(2), `${pct}%`];
      }),
      ["Revenue", "Total revenue", toNaira(totalBudgetedRevenue).toFixed(2), toNaira(totalActualRevenue).toFixed(2), "", ""],
      ...expenseLines.map((line) => {
        const budgeted = BigInt(line.amount_kobo);
        const actual = actualByCode.get(line.account_code) ?? 0n;
        const pct = budgeted > 0n ? Number((actual * 100n) / budgeted) : 0;
        return ["Expense", accountLabel(line.account_code), toNaira(budgeted).toFixed(2), toNaira(actual).toFixed(2), toNaira(actual - budgeted).toFixed(2), `${pct}%`];
      }),
      ["Expense", "Total expenses", toNaira(totalBudgetedExpense).toFixed(2), toNaira(totalActualExpense).toFixed(2), "", ""],
      ["Net", "Net (budgeted)", toNaira(totalBudgetedRevenue - totalBudgetedExpense).toFixed(2), "", "", ""],
      ["Net", "Net (actual)", "", toNaira(totalActualRevenue - totalActualExpense).toFixed(2), "", ""],
    ],
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            <Link href="/budgets" className="text-primary print:hidden">
              Budgets
            </Link>
            <span className="hidden print:inline">Budgets</span> / {budget.name}
          </span>
          <div className="flex items-center gap-2 print:hidden">
            <ExportCsvButton csv={csv} filename={`budget-${budget.name}.csv`} />
            <PrintButton>Print / Save as PDF</PrintButton>
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">{budget.name}</h1>
        <p className="text-[13px] text-ink-soft">
          {budget.period_start} – {budget.period_end}. Actuals pulled live from the general ledger for this range.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Account</th>
              <th className={`${thClass} text-right`}>Budgeted</th>
              <th className={`${thClass} text-right`}>Actual</th>
              <th className={`${thClass} text-right`}>Variance</th>
              <th className={`${thClass} text-right`}>% of budget</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-bg">
              <td colSpan={canManage ? 6 : 5} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Revenue
              </td>
            </tr>
            {revenueLines.length > 0 ? (
              renderRows(revenueLines, "revenue")
            ) : (
              <tr>
                <td colSpan={canManage ? 6 : 5} className={`${tdClass} text-ink-soft`}>
                  No revenue accounts budgeted.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total revenue</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalBudgetedRevenue)}</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalActualRevenue)}</td>
              <td colSpan={canManage ? 3 : 2}></td>
            </tr>

            <tr className="border-b border-border bg-bg">
              <td colSpan={canManage ? 6 : 5} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Expenses
              </td>
            </tr>
            {expenseLines.length > 0 ? (
              renderRows(expenseLines, "expense")
            ) : (
              <tr>
                <td colSpan={canManage ? 6 : 5} className={`${tdClass} text-ink-soft`}>
                  No expense accounts budgeted.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total expenses</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalBudgetedExpense)}</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalActualExpense)}</td>
              <td colSpan={canManage ? 3 : 2}></td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${tdClass} font-extrabold text-ink`}>Net (budgeted)</td>
              <td className={`${tdClass} text-right font-extrabold text-ink`} colSpan={canManage ? 5 : 4}>
                {formatKobo(totalBudgetedRevenue - totalBudgetedExpense)}
              </td>
            </tr>
            <tr>
              <td className={`${tdClass} font-extrabold text-ink`}>Net (actual)</td>
              <td className={`${tdClass} text-right font-extrabold text-ink`} colSpan={canManage ? 5 : 4}>
                {formatKobo(totalActualRevenue - totalActualExpense)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {unbudgetedActuals.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Posted this period with no budget line
          </span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[400px] border-collapse">
              <tbody>
                {unbudgetedActuals.map(([code, amount]) => (
                  <tr key={code} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex flex-col gap-5 print:hidden">
          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
              Add or update a budget line
            </span>
            <div className="mt-3">
              <BudgetLineForm budgetId={budget.id} accounts={revenueExpenseAccounts} />
            </div>
          </div>

          <form action={deleteBudget.bind(null, budget.id)} className="flex justify-end">
            <button type="submit" className="text-[12px] font-bold text-bad">
              Delete this budget
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
