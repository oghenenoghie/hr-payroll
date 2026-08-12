import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";
import { getCachedChartOfAccounts } from "@/lib/reference-data";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { BudgetLineForm } from "./BudgetLineForm";
import { deleteBudgetLine, deleteBudget } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const BUDGET_TYPE_LABEL: Record<string, string> = {
  operating: "Operating",
  capital: "Capital",
  cash: "Cash",
};

// Which account types a budget's lines may cover, keyed by budget_type —
// matches the same branch upsertBudgetLine validates against server-side.
// "Favorable/unfavorable" coloring only applies to operating (revenue and
// expense have an unambiguous "more/less is good" direction); a capital or
// cash line's balance rising or falling isn't uniformly good or bad the
// way revenue or expense is, so those show plan vs. actual without a
// judgment — a disclosed simplification, not an oversight.
function accountsForType<T extends { code: string; type: string }>(budgetType: string, accounts: T[]): T[] {
  if (budgetType === "capital") return accounts.filter((a) => a.type === "asset");
  if (budgetType === "cash") return accounts.filter((a) => a.type === "liability" || a.code === "cash_and_bank");
  return accounts.filter((a) => a.type === "revenue" || a.type === "expense");
}

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

  const { data: budgetRow } = await supabase.from("budgets").select("*").eq("id", id).single();
  if (!budgetRow) notFound();
  const budget = budgetRow;

  // Independent of each other — accounts and budget lines don't depend on
  // journal_entries, and journal_entries only needs the budget's own dates
  // (already known) — so all three run concurrently. Journal entries are
  // fetched once for the budget's whole period (a superset of every
  // line's own, possibly narrower, period) and entry_date is carried
  // along so each line's actual can be computed against its own period
  // rather than the budget's.
  const [accounts, { data: lines }, { data: journalEntries }] = await Promise.all([
    getCachedChartOfAccounts(membership.orgId),
    supabase.from("budget_lines").select("*").eq("budget_id", id),
    supabase.from("journal_entries").select("id, entry_date").gte("entry_date", budget.period_start).lte("entry_date", budget.period_end),
  ]);
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const accountLabel = (code: string) => accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;
  const relevantAccounts = accountsForType(budget.budget_type, accounts);

  const budgetLines = lines ?? [];
  const budgetedCodes = new Set(budgetLines.map((l) => l.account_code));

  const entryDateById = new Map((journalEntries ?? []).map((entry) => [entry.id, entry.entry_date]));
  const journalEntryIds = [...entryDateById.keys()];

  const { data: postingsRaw } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("journal_entry_id, account_code, direction, amount_kobo")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };
  const postings = (postingsRaw ?? []).map((posting) => ({
    ...posting,
    entry_date: entryDateById.get(posting.journal_entry_id) ?? "",
  }));

  // Revenue and liability are credit-normal (more credit = more of the
  // thing); expense and asset are debit-normal — the exact same sign
  // convention the Balance Sheet already uses per account.type, reused
  // here rather than reinvented.
  function signedAmount(type: string | undefined, direction: string, amountKobo: number): bigint {
    const amount = BigInt(amountKobo);
    const creditPositive = type === "revenue" || type === "liability";
    const raw = direction === "credit" ? amount : -amount;
    return creditPositive ? raw : -raw;
  }

  function actualForLine(line: (typeof budgetLines)[number]): bigint {
    let total = 0n;
    for (const posting of postings) {
      if (posting.account_code !== line.account_code) continue;
      if (posting.entry_date < line.period_start || posting.entry_date > line.period_end) continue;
      total += signedAmount(accountByCode.get(posting.account_code)?.type, posting.direction, posting.amount_kobo);
    }
    return total;
  }

  // Whole-budget-period totals, for the "posted with no budget line"
  // callout — deliberately not scoped to any one line's narrower period,
  // since this is about activity the budget doesn't cover at all yet.
  const actualByCodeWholePeriod = new Map<string, bigint>();
  for (const posting of postings) {
    const type = accountByCode.get(posting.account_code)?.type;
    if (!relevantAccounts.some((a) => a.code === posting.account_code)) continue;
    const current = actualByCodeWholePeriod.get(posting.account_code) ?? 0n;
    actualByCodeWholePeriod.set(posting.account_code, current + signedAmount(type, posting.direction, posting.amount_kobo));
  }

  const sortedLines = [...budgetLines].sort(
    (a, b) => a.period_start.localeCompare(b.period_start) || accountLabel(a.account_code).localeCompare(accountLabel(b.account_code)),
  );
  const revenueLines = sortedLines.filter((l) => accountByCode.get(l.account_code)?.type === "revenue");
  const expenseLines = sortedLines.filter((l) => accountByCode.get(l.account_code)?.type === "expense");
  const otherLines = budget.budget_type !== "operating" ? sortedLines : [];

  const totalBudgetedRevenue = revenueLines.reduce((sum, l) => sum + BigInt(l.amount_kobo), 0n);
  const totalBudgetedExpense = expenseLines.reduce((sum, l) => sum + BigInt(l.amount_kobo), 0n);
  const totalBudgetedOther = otherLines.reduce((sum, l) => sum + BigInt(l.amount_kobo), 0n);
  const totalActualRevenue = revenueLines.reduce((sum, l) => sum + actualForLine(l), 0n);
  const totalActualExpense = expenseLines.reduce((sum, l) => sum + actualForLine(l), 0n);
  const totalActualOther = otherLines.reduce((sum, l) => sum + actualForLine(l), 0n);

  const unbudgetedActuals = [...actualByCodeWholePeriod.entries()].filter(
    ([code, amount]) => !budgetedCodes.has(code) && amount !== 0n,
  );

  const showFavorability = budget.budget_type === "operating";

  function renderRows(rows: typeof budgetLines, type: "revenue" | "expense" | "other") {
    return rows.map((line) => {
      const budgeted = BigInt(line.amount_kobo);
      const actual = actualForLine(line);
      const variance = actual - budgeted;
      const favorable = type === "revenue" ? variance >= 0n : variance <= 0n;
      const pctOfBudget = budgeted > 0n ? Number((actual * 100n) / budgeted) : 0;
      return (
        <tr key={line.id} className="border-b border-border last:border-b-0">
          <td className={`${tdClass} text-ink`}>{accountLabel(line.account_code)}</td>
          <td className={`${tdClass} text-ink-soft`}>
            {line.period_start} – {line.period_end}
          </td>
          <td className={`${tdClass} text-right text-ink`}>{formatKobo(budgeted)}</td>
          <td className={`${tdClass} text-right text-ink`}>{formatKobo(actual)}</td>
          <td className={`${tdClass} text-right font-bold ${showFavorability ? (favorable ? "text-good" : "text-bad") : "text-ink"}`}>
            {formatKobo(variance < 0n ? -variance : variance)}
            {showFavorability ? ` ${favorable ? "under" : "over"}` : variance < 0n ? " under" : variance > 0n ? " over" : ""}
          </td>
          <td className={`${tdClass} text-right text-ink-soft`}>{pctOfBudget}%</td>
          {canManage && (
            <td className={`${tdClass} text-right`}>
              <ConfirmActionButton
                action={deleteBudgetLine.bind(null, line.id, budget.id)}
                label="Delete"
                confirmTitle="Delete this budget line?"
                confirmMessage={`The ${accountLabel(line.account_code)} line for ${line.period_start} – ${line.period_end} will be removed from this budget.`}
                confirmLabel="Delete"
              />
            </td>
          )}
        </tr>
      );
    });
  }

  const csvRowFor = (line: (typeof budgetLines)[number], section: string) => {
    const budgeted = BigInt(line.amount_kobo);
    const actual = actualForLine(line);
    const pct = budgeted > 0n ? Number((actual * 100n) / budgeted) : 0;
    return [
      section,
      accountLabel(line.account_code),
      `${line.period_start} to ${line.period_end}`,
      toNaira(budgeted).toFixed(2),
      toNaira(actual).toFixed(2),
      toNaira(actual - budgeted).toFixed(2),
      `${pct}%`,
    ];
  };

  const csv = toCsv(
    ["Section", "Account", "Period", "Budgeted (NGN)", "Actual (NGN)", "Variance (NGN)", "% of budget"],
    budget.budget_type === "operating"
      ? [
          ...revenueLines.map((l) => csvRowFor(l, "Revenue")),
          ["Revenue", "Total revenue", "", toNaira(totalBudgetedRevenue).toFixed(2), toNaira(totalActualRevenue).toFixed(2), "", ""],
          ...expenseLines.map((l) => csvRowFor(l, "Expense")),
          ["Expense", "Total expenses", "", toNaira(totalBudgetedExpense).toFixed(2), toNaira(totalActualExpense).toFixed(2), "", ""],
          ["Net", "Net (budgeted)", "", toNaira(totalBudgetedRevenue - totalBudgetedExpense).toFixed(2), "", "", ""],
          ["Net", "Net (actual)", "", "", toNaira(totalActualRevenue - totalActualExpense).toFixed(2), "", ""],
        ]
      : [
          ...otherLines.map((l) => csvRowFor(l, BUDGET_TYPE_LABEL[budget.budget_type] ?? budget.budget_type)),
          [
            BUDGET_TYPE_LABEL[budget.budget_type] ?? budget.budget_type,
            "Total",
            "",
            toNaira(totalBudgetedOther).toFixed(2),
            toNaira(totalActualOther).toFixed(2),
            "",
            "",
          ],
        ],
  );

  const sectionColSpan = canManage ? 6 : 5;

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
          {BUDGET_TYPE_LABEL[budget.budget_type] ?? budget.budget_type} budget · {budget.period_start} –{" "}
          {budget.period_end}. Actuals pulled live from the general ledger, computed against each line&apos;s own
          period.
        </p>
        {!showFavorability && (
          <p className="text-[12px] text-ink-soft">
            {budget.budget_type === "capital" ? "Capital" : "Cash"} lines show plan vs. actual without a
            favorable/unfavorable judgment — a balance rising or falling isn&apos;t uniformly good or bad the way
            revenue or expense is.
          </p>
        )}
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Account</th>
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-right`}>Budgeted</th>
              <th className={`${thClass} text-right`}>Actual</th>
              <th className={`${thClass} text-right`}>Variance</th>
              <th className={`${thClass} text-right`}>% of budget</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {budget.budget_type === "operating" ? (
              <>
                <tr className="border-b border-border bg-bg">
                  <td colSpan={sectionColSpan} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                    Revenue
                  </td>
                </tr>
                {revenueLines.length > 0 ? (
                  renderRows(revenueLines, "revenue")
                ) : (
                  <tr>
                    <td colSpan={sectionColSpan} className={`${tdClass} text-ink-soft`}>
                      No revenue accounts budgeted.
                    </td>
                  </tr>
                )}
                <tr className="border-b-2 border-border">
                  <td className={`${tdClass} font-bold text-ink`}>Total revenue</td>
                  <td></td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalBudgetedRevenue)}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalActualRevenue)}</td>
                  <td colSpan={canManage ? 3 : 2}></td>
                </tr>

                <tr className="border-b border-border bg-bg">
                  <td colSpan={sectionColSpan} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                    Expenses
                  </td>
                </tr>
                {expenseLines.length > 0 ? (
                  renderRows(expenseLines, "expense")
                ) : (
                  <tr>
                    <td colSpan={sectionColSpan} className={`${tdClass} text-ink-soft`}>
                      No expense accounts budgeted.
                    </td>
                  </tr>
                )}
                <tr className="border-b-2 border-border">
                  <td className={`${tdClass} font-bold text-ink`}>Total expenses</td>
                  <td></td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalBudgetedExpense)}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalActualExpense)}</td>
                  <td colSpan={canManage ? 3 : 2}></td>
                </tr>
              </>
            ) : (
              <>
                <tr className="border-b border-border bg-bg">
                  <td colSpan={sectionColSpan} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                    {budget.budget_type === "capital" ? "Capital expenditure" : "Obligations & cash position"}
                  </td>
                </tr>
                {otherLines.length > 0 ? (
                  renderRows(otherLines, "other")
                ) : (
                  <tr>
                    <td colSpan={sectionColSpan} className={`${tdClass} text-ink-soft`}>
                      No accounts budgeted yet.
                    </td>
                  </tr>
                )}
                <tr className="border-b-2 border-border">
                  <td className={`${tdClass} font-bold text-ink`}>Total</td>
                  <td></td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalBudgetedOther)}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalActualOther)}</td>
                  <td colSpan={canManage ? 3 : 2}></td>
                </tr>
              </>
            )}
          </tbody>
          {budget.budget_type === "operating" && (
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
          )}
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
              <BudgetLineForm
                budgetId={budget.id}
                accounts={relevantAccounts}
                periodStart={budget.period_start}
                periodEnd={budget.period_end}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <ConfirmActionButton
              action={deleteBudget.bind(null, budget.id)}
              label="Delete this budget"
              confirmTitle="Delete this budget?"
              confirmMessage={`"${budget.name}" and every one of its budget lines will be removed. This can't be undone.`}
              confirmLabel="Delete budget"
            />
          </div>
        </div>
      )}
    </div>
  );
}
