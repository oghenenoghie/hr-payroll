import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>;
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

  const { as_of: asOfParam } = await searchParams;
  const asOf = asOfParam || todayIso();

  const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, type");
  const accountByCode = new Map((accounts ?? []).map((account) => [account.code, account]));
  const accountLabel = (code: string) => accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;

  // Point-in-time, not a range: every journal entry ever posted on or
  // before this date, since a balance sheet is a cumulative position, not
  // a period total the way the P&L is.
  const { data: journalEntries } = await supabase.from("journal_entries").select("id").lte("entry_date", asOf);
  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);

  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("account_code, direction, amount_kobo")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };

  const assetByAccount = new Map<string, bigint>();
  const liabilityByAccount = new Map<string, bigint>();
  const equityByAccount = new Map<string, bigint>();
  let cumulativeRevenue = 0n;
  let cumulativeExpense = 0n;

  for (const posting of postings ?? []) {
    const type = accountByCode.get(posting.account_code)?.type;
    const amount = BigInt(posting.amount_kobo);
    const signedDebit = posting.direction === "debit" ? amount : -amount;
    const signedCredit = posting.direction === "credit" ? amount : -amount;

    if (type === "asset") {
      assetByAccount.set(posting.account_code, (assetByAccount.get(posting.account_code) ?? 0n) + signedDebit);
    } else if (type === "liability") {
      liabilityByAccount.set(posting.account_code, (liabilityByAccount.get(posting.account_code) ?? 0n) + signedCredit);
    } else if (type === "equity") {
      equityByAccount.set(posting.account_code, (equityByAccount.get(posting.account_code) ?? 0n) + signedCredit);
    } else if (type === "revenue") {
      cumulativeRevenue += signedCredit;
    } else if (type === "expense") {
      cumulativeExpense += signedDebit;
    }
  }

  const assetRows = [...assetByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const liabilityRows = [...liabilityByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const equityRows = [...equityByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const totalAssets = assetRows.reduce((sum, [, amount]) => sum + amount, 0n);
  const totalLiabilities = liabilityRows.reduce((sum, [, amount]) => sum + amount, 0n);
  // Retained earnings isn't its own posted account — this build has no
  // period-close step that sweeps revenue/expense into equity — so it's
  // derived here as cumulative net income to date. The fundamental
  // accounting identity (assets = liabilities + equity, which falls out
  // directly from every journal entry balancing) guarantees this makes
  // the sheet balance exactly, not approximately.
  const retainedEarnings = cumulativeRevenue - cumulativeExpense;
  const totalEquity = equityRows.reduce((sum, [, amount]) => sum + amount, 0n) + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const csv = toCsv(
    ["Section", "Account", "Balance (NGN)"],
    [
      ...assetRows.map(([code, amount]) => ["Asset", accountLabel(code), toNaira(amount).toFixed(2)]),
      ["Asset", "Total assets", toNaira(totalAssets).toFixed(2)],
      ...liabilityRows.map(([code, amount]) => ["Liability", accountLabel(code), toNaira(amount).toFixed(2)]),
      ["Liability", "Total liabilities", toNaira(totalLiabilities).toFixed(2)],
      ...equityRows.map(([code, amount]) => ["Equity", accountLabel(code), toNaira(amount).toFixed(2)]),
      ["Equity", "Retained earnings (net income to date)", toNaira(retainedEarnings).toFixed(2)],
      ["Equity", "Total equity", toNaira(totalEquity).toFixed(2)],
      ["", "Total liabilities + equity", toNaira(totalLiabilitiesAndEquity).toFixed(2)],
    ],
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Financial Statements</span>
          <div className="flex items-center gap-2 print:hidden">
            <ExportCsvButton csv={csv} filename={`balance-sheet-${asOf}.csv`} />
            <PrintButton>Print / Save as PDF</PrintButton>
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Balance Sheet</h1>
        <p className="text-[13px] text-ink-soft">
          A snapshot of everything posted to the general ledger up to a single date, not a range — assets on one
          side, what&apos;s owed and what&apos;s retained on the other. Assets = Liabilities + Equity always, by
          construction: every posting behind this comes from a balanced journal entry.
        </p>
        <Link href="/financial-statements" className="mt-1 text-[12.5px] font-bold text-primary print:hidden">
          View Profit &amp; Loss →
        </Link>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4 print:hidden"
        action="/financial-statements/balance-sheet"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="as_of">
            As of
          </label>
          <input
            id="as_of"
            name="as_of"
            type="date"
            defaultValue={asOf}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Account</th>
              <th className={`${thClass} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-bg">
              <td colSpan={2} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Assets
              </td>
            </tr>
            {assetRows.length > 0 ? (
              assetRows.map(([code, amount]) => (
                <tr key={code} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className={`${tdClass} text-ink-soft`}>
                  No assets posted as of this date.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total assets</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalAssets)}</td>
            </tr>

            <tr className="border-b border-border bg-bg">
              <td colSpan={2} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Liabilities
              </td>
            </tr>
            {liabilityRows.length > 0 ? (
              liabilityRows.map(([code, amount]) => (
                <tr key={code} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className={`${tdClass} text-ink-soft`}>
                  No liabilities posted as of this date.
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total liabilities</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalLiabilities)}</td>
            </tr>

            <tr className="border-b border-border bg-bg">
              <td colSpan={2} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                Equity
              </td>
            </tr>
            {equityRows.map(([code, amount]) => (
              <tr key={code} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} text-ink`}>{accountLabel(code)}</td>
                <td className={`${tdClass} text-right text-ink`}>{formatKobo(amount)}</td>
              </tr>
            ))}
            <tr className="border-b border-border last:border-b-0">
              <td className={`${tdClass} text-ink-soft`}>Retained earnings (net income to date)</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(retainedEarnings)}</td>
            </tr>
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Total equity</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totalEquity)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${tdClass} font-extrabold text-ink`}>Total liabilities + equity</td>
              <td className={`${tdClass} text-right font-extrabold text-ink`}>
                {formatKobo(totalLiabilitiesAndEquity)}
              </td>
            </tr>
            <tr>
              <td className={`${tdClass} font-bold text-ink-soft`}>Balanced against total assets</td>
              <td
                className={`${tdClass} text-right font-bold ${
                  totalAssets === totalLiabilitiesAndEquity ? "text-good" : "text-bad"
                }`}
              >
                {totalAssets === totalLiabilitiesAndEquity ? "Yes" : "No — check the ledger"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
