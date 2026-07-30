import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
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
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "accountant")
  ) {
    redirect("/dashboard");
  }

  const { from, to } = await searchParams;

  const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, type");
  const accountByCode = new Map((accounts ?? []).map((account) => [account.code, account]));
  const accountLabel = (code: string) => accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;

  let journalEntriesQuery = supabase.from("journal_entries").select("id");
  if (from) journalEntriesQuery = journalEntriesQuery.gte("entry_date", from);
  if (to) journalEntriesQuery = journalEntriesQuery.lte("entry_date", to);

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

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Financial Statements</span>
        <h1 className="text-[22px] font-extrabold text-ink">Profit &amp; Loss</h1>
        <p className="text-[13px] text-ink-soft">
          Revenue and expense for the period, derived directly from the general ledger — nothing here is entered by
          hand. Leave the dates blank for all time.
        </p>
        <Link href="/financial-statements/balance-sheet" className="mt-1 text-[12.5px] font-bold text-primary">
          View Balance Sheet →
        </Link>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4" action="/financial-statements">
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
        {(from || to) && (
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
