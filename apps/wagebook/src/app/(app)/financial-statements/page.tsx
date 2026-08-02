import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";
import { getCachedChartOfAccounts } from "@/lib/reference-data";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function currentYearStart(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; all?: string }>;
}) {
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

  const { from: fromParam, to, all } = await searchParams;
  const showAllTime = all === "1";
  // Defaults to the current year to date rather than an unbounded scan of
  // every posting ever made — a P&L with no range was silently pulling
  // the entire ledger on every visit. "All time" is still one explicit
  // click away, not removed, just no longer the silent default.
  const from = !showAllTime && !fromParam && !to ? currentYearStart() : fromParam;

  const accounts = await getCachedChartOfAccounts(membership.orgId);
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const accountLabel = (code: string) => accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;

  let journalEntriesQuery = supabase.from("journal_entries").select("id");
  if (!showAllTime && from) journalEntriesQuery = journalEntriesQuery.gte("entry_date", from);
  if (!showAllTime && to) journalEntriesQuery = journalEntriesQuery.lte("entry_date", to);

  const { data: journalEntries } = await journalEntriesQuery;
  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);

  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("account_code, direction, amount_kobo")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };

  // Revenue and expense are both credit/debit-normal respectively — net
  // balance is the "normal side" total minus the "contra side" total, the
  // figure that's actually meaningful to read as a plain naira amount
  // rather than raw debit/credit totals.
  const revenueByAccount = new Map<string, bigint>();
  const expenseByAccount = new Map<string, bigint>();
  for (const posting of postings ?? []) {
    const type = accountByCode.get(posting.account_code)?.type;
    const signedAmount = posting.direction === "credit" ? BigInt(posting.amount_kobo) : -BigInt(posting.amount_kobo);
    if (type === "revenue") {
      revenueByAccount.set(posting.account_code, (revenueByAccount.get(posting.account_code) ?? 0n) + signedAmount);
    } else if (type === "expense") {
      expenseByAccount.set(posting.account_code, (expenseByAccount.get(posting.account_code) ?? 0n) - signedAmount);
    }
  }

  const revenueRows = [...revenueByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const expenseRows = [...expenseByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalRevenue = revenueRows.reduce((sum, [, amount]) => sum + amount, 0n);
  const totalExpense = expenseRows.reduce((sum, [, amount]) => sum + amount, 0n);
  const netIncome = totalRevenue - totalExpense;

  const csv = toCsv(
    ["Section", "Account", "Amount (NGN)"],
    [
      ...revenueRows.map(([code, amount]) => ["Revenue", accountLabel(code), toNaira(amount).toFixed(2)]),
      ["Revenue", "Total revenue", toNaira(totalRevenue).toFixed(2)],
      ...expenseRows.map(([code, amount]) => ["Expense", accountLabel(code), toNaira(amount).toFixed(2)]),
      ["Expense", "Total expenses", toNaira(totalExpense).toFixed(2)],
      [netIncome >= 0n ? "Net income" : "Net loss", "", toNaira(netIncome).toFixed(2)],
    ],
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Financial Statements</span>
          <div className="flex items-center gap-2 print:hidden">
            <ExportCsvButton csv={csv} filename="profit-and-loss.csv" />
            <PrintButton>Print / Save as PDF</PrintButton>
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Profit &amp; Loss</h1>
        <p className="text-[13px] text-ink-soft">
          Revenue and expense for the period, derived directly from the general ledger — nothing here is entered by
          hand. Defaults to the current year to date;{" "}
          {showAllTime ? (
            "showing every posting ever made."
          ) : (
            <Link href="/financial-statements?all=1" className="font-bold text-primary print:hidden">
              view all time →
            </Link>
          )}
        </p>
        <Link href="/financial-statements/balance-sheet" className="mt-1 text-[12.5px] font-bold text-primary print:hidden">
          View Balance Sheet →
        </Link>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4 print:hidden"
        action="/financial-statements"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="from">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="to">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink">
          Filter
        </button>
        {(fromParam || to || showAllTime) && (
          <Link href="/financial-statements" className="px-2 py-[9px] text-[12.5px] font-bold text-primary">
            Clear filters
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Account</th>
              <th className={`${thClass} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-bg">
              <td colSpan={2} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Revenue
              </td>
            </tr>
            {revenueRows.length > 0 ? (
              revenueRows.map(([code, amount]) => (
                <tr key={code} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className={`${tdClass} text-ink-soft`}>
                  No revenue posted in this period.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total revenue</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalRevenue)}</td>
            </tr>

            <tr className="border-b border-border bg-bg">
              <td colSpan={2} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Expenses
              </td>
            </tr>
            {expenseRows.length > 0 ? (
              expenseRows.map(([code, amount]) => (
                <tr key={code} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className={`${tdClass} text-ink-soft`}>
                  No expenses posted in this period.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total expenses</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalExpense)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${tdClass} font-extrabold text-ink`}>{netIncome >= 0n ? "Net income" : "Net loss"}</td>
              <td className={`${tdClass} text-right font-extrabold ${netIncome >= 0n ? "text-good" : "text-bad"}`}>
                {formatKobo(netIncome < 0n ? -netIncome : netIncome)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
