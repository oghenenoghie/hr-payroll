import { Fragment } from "react";
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

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
const TYPE_LABEL: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

const PAGE_SIZE = 25;

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
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
      membership.role !== "auditor")
  ) {
    redirect("/dashboard");
  }

  const { from, to, page: pageParam } = await searchParams;

  const accounts = await getCachedChartOfAccounts(membership.orgId);
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));

  // Unbounded by row count (only by the date range, if any) — the trial
  // balance below must reflect every posting in range to be correct, so
  // it can never be built from a capped "most recent N" slice. What used
  // to be a hard 100-entry cap on this same query silently made the trial
  // balance wrong for any range with more than 100 entries; the fix is to
  // always fetch the full range and paginate only the on-screen list of
  // individual entries further down, which costs nothing extra since the
  // full set is already in memory for the trial balance anyway.
  let journalEntriesQuery = supabase
    .from("journal_entries")
    .select("id, memo, entry_date")
    .order("entry_date", { ascending: false });
  if (from) journalEntriesQuery = journalEntriesQuery.gte("entry_date", from);
  if (to) journalEntriesQuery = journalEntriesQuery.lte("entry_date", to);

  const { data: journalEntries } = await journalEntriesQuery;
  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);

  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("journal_entry_id, account_code, direction, amount_kobo")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };

  // Trial balance: every account that appears in a posting, debits and
  // credits summed separately (not netted) — the classic presentation,
  // and the one where "do total debits equal total credits" is visible
  // at a glance rather than hidden inside a single net figure.
  const trialBalance = new Map<string, { debit: bigint; credit: bigint }>();
  for (const posting of postings ?? []) {
    const entry = trialBalance.get(posting.account_code) ?? { debit: 0n, credit: 0n };
    if (posting.direction === "debit") {
      entry.debit += BigInt(posting.amount_kobo);
    } else {
      entry.credit += BigInt(posting.amount_kobo);
    }
    trialBalance.set(posting.account_code, entry);
  }

  const grandTotalDebit = [...trialBalance.values()].reduce((sum, v) => sum + v.debit, 0n);
  const grandTotalCredit = [...trialBalance.values()].reduce((sum, v) => sum + v.credit, 0n);

  const postingsByJournalEntry = new Map<string, typeof postings>();
  for (const posting of postings ?? []) {
    const list = postingsByJournalEntry.get(posting.journal_entry_id) ?? [];
    list.push(posting);
    postingsByJournalEntry.set(posting.journal_entry_id, list);
  }

  function accountLabel(code: string): string {
    return accountByCode.get(code)?.name ?? ACCOUNT_LABEL[code] ?? code;
  }

  const journalEntryById = new Map((journalEntries ?? []).map((entry) => [entry.id, entry]));

  // Pagination is applied only to the on-screen list of individual entries
  // below — the trial balance and CSV exports above still reflect the
  // full range, computed from the same already-fetched data at no extra
  // query cost.
  const totalEntries = journalEntries?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);
  const pagedEntries = (journalEntries ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    return `/general-ledger?${params.toString()}`;
  }

  const trialBalanceCsv = toCsv(
    ["Account", "Debit (NGN)", "Credit (NGN)"],
    [...trialBalance.entries()].map(([code, totals]) => [
      accountLabel(code),
      totals.debit > 0n ? toNaira(totals.debit).toFixed(2) : "",
      totals.credit > 0n ? toNaira(totals.credit).toFixed(2) : "",
    ]),
  );

  const journalEntriesCsv = toCsv(
    ["Date", "Memo", "Account", "Debit (NGN)", "Credit (NGN)"],
    (postings ?? []).map((posting) => {
      const entry = journalEntryById.get(posting.journal_entry_id);
      const amountNaira = toNaira(BigInt(posting.amount_kobo)).toFixed(2);
      return [
        entry?.entry_date ?? "",
        entry?.memo ?? "",
        accountLabel(posting.account_code),
        posting.direction === "debit" ? amountNaira : "",
        posting.direction === "credit" ? amountNaira : "",
      ];
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
        <h1 className="text-[22px] font-extrabold text-ink">General Ledger &amp; Trial Balance</h1>
        <p className="text-[13px] text-ink-soft">
          Every journal entry ever posted — by payroll, final settlement, or accounts payable — is a real, balanced
          double-entry. The trial balance below isn&apos;t computed to balance; it balances because the database
          rejects any entry that doesn&apos;t, by construction.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4" action="/general-ledger">
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
          <Link href="/general-ledger" className="px-2 py-[9px] text-[12.5px] font-bold text-primary">
            Clear filters
          </Link>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Trial balance</span>
          {trialBalance.size > 0 && <ExportCsvButton csv={trialBalanceCsv} filename="trial-balance.csv" />}
        </div>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Account</th>
                <th className={`${thClass} text-right`}>Debit</th>
                <th className={`${thClass} text-right`}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map((type) => {
                const codes = [...trialBalance.keys()]
                  .filter((code) => (accountByCode.get(code)?.type ?? "expense") === type)
                  .sort();
                if (codes.length === 0) return null;

                return (
                  <Fragment key={type}>
                    <tr className="border-b border-border bg-bg">
                      <td colSpan={3} className={`${tdClass} font-bold uppercase tracking-[0.03em] text-ink-soft`}>
                        {TYPE_LABEL[type]}
                      </td>
                    </tr>
                    {codes.map((code) => {
                      const totals = trialBalance.get(code)!;
                      return (
                        <tr key={code} className="border-b border-border last:border-b-0">
                          <td className={`${tdClass} font-bold text-ink`}>{accountLabel(code)}</td>
                          <td className={`${tdClass} text-right text-ink`}>
                            {totals.debit > 0n ? formatKobo(totals.debit) : "—"}
                          </td>
                          <td className={`${tdClass} text-right text-ink`}>
                            {totals.credit > 0n ? formatKobo(totals.credit) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {trialBalance.size === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No postings in this range.
                  </td>
                </tr>
              )}
            </tbody>
            {trialBalance.size > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className={`${tdClass} font-extrabold text-ink`}>Total</td>
                  <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(grandTotalDebit)}</td>
                  <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(grandTotalCredit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Journal entries {totalEntries > 0 && `(${totalEntries} total)`}
          </span>
          {journalEntries && journalEntries.length > 0 && (
            <ExportCsvButton csv={journalEntriesCsv} filename="journal-entries.csv" />
          )}
        </div>
        <div className="flex flex-col gap-3">
          {pagedEntries.length > 0 ? (
            pagedEntries.map((entry) => (
              <div key={entry.id} className="overflow-x-auto rounded-card border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-3 py-[10px]">
                  <span className="text-[13px] font-bold text-ink">{entry.memo}</span>
                  <span className="text-[12px] text-ink-soft">{entry.entry_date}</span>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {(postingsByJournalEntry.get(entry.id) ?? []).map((posting, index) => (
                      <tr key={index} className="border-b border-border last:border-b-0">
                        <td className={`${tdClass} text-ink-soft`}>{accountLabel(posting.account_code)}</td>
                        <td className={`${tdClass} text-right text-ink`}>
                          {posting.direction === "debit" ? formatKobo(BigInt(posting.amount_kobo)) : ""}
                        </td>
                        <td className={`${tdClass} text-right text-ink`}>
                          {posting.direction === "credit" ? formatKobo(BigInt(posting.amount_kobo)) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
              No journal entries in this range.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages}
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
