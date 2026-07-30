import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ReconciliationStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";
import { StatementLineForm } from "./StatementLineForm";
import { matchStatementLine, unmatchStatementLine, completeReconciliation } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BankReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: reconciliation } = await supabase.from("bank_reconciliations").select("*").eq("id", id).single();
  if (!reconciliation) notFound();

  // journalEntries, matchedElsewhere and lines are independent of one
  // another — only postings genuinely depends on journalEntries' ids, so
  // it stays a second step while the rest run concurrently.
  const [{ data: journalEntries }, { data: matchedElsewhere }, { data: lines }] = await Promise.all([
    // Point-in-time, matching the Balance Sheet: every cash_and_bank
    // posting on or before this reconciliation's period end, not a range.
    supabase.from("journal_entries").select("id, entry_date, memo").lte("entry_date", reconciliation.period_end),
    supabase.from("bank_statement_lines").select("matched_posting_id").not("matched_posting_id", "is", null),
    supabase.from("bank_statement_lines").select("*").eq("reconciliation_id", id).order("line_date"),
  ]);
  const journalEntryById = new Map((journalEntries ?? []).map((entry) => [entry.id, entry]));
  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);

  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase
          .from("ledger_postings")
          .select("id, journal_entry_id, direction, amount_kobo")
          .eq("account_code", "cash_and_bank")
          .in("journal_entry_id", journalEntryIds)
      : { data: [] };

  const matchedPostingIds = new Set((matchedElsewhere ?? []).map((line) => line.matched_posting_id));

  const allPostings = postings ?? [];
  // Debit increases cash, credit decreases it — the same asset convention
  // the Balance Sheet page uses for every asset account.
  const bookBalance = allPostings.reduce(
    (sum, p) => sum + (p.direction === "debit" ? BigInt(p.amount_kobo) : -BigInt(p.amount_kobo)),
    0n,
  );
  const unmatchedPostings = allPostings.filter((p) => !matchedPostingIds.has(p.id));
  const unmatchedBookEffect = unmatchedPostings.reduce(
    (sum, p) => sum + (p.direction === "debit" ? BigInt(p.amount_kobo) : -BigInt(p.amount_kobo)),
    0n,
  );

  const allLines = lines ?? [];
  const matchedLines = allLines.filter((l) => l.matched_posting_id);
  const unmatchedLines = allLines.filter((l) => !l.matched_posting_id);
  const unmatchedBankEffect = unmatchedLines.reduce(
    (sum, l) => sum + (l.type === "deposit" ? BigInt(l.amount_kobo) : -BigInt(l.amount_kobo)),
    0n,
  );

  const statementBalance = BigInt(reconciliation.statement_balance_kobo);
  const adjustedBookBalance = bookBalance + unmatchedBankEffect;
  const adjustedBankBalance = statementBalance + unmatchedBookEffect;
  const difference = adjustedBookBalance - adjustedBankBalance;
  const isBalanced = difference === 0n;

  const postingLabel = (postingId: string | null) => {
    if (!postingId) return "—";
    const posting = allPostings.find((p) => p.id === postingId);
    if (!posting) return "—";
    const entry = journalEntryById.get(posting.journal_entry_id);
    const sign = posting.direction === "debit" ? "+" : "-";
    return `${entry?.entry_date ?? "—"} · ${entry?.memo ?? "—"} · ${sign}${formatKobo(BigInt(posting.amount_kobo))}`;
  };

  const csv = toCsv(
    ["Date", "Description", "Type", "Amount (NGN)", "Matched"],
    allLines.map((line) => [
      line.line_date,
      line.description,
      line.type,
      toNaira(BigInt(line.amount_kobo)).toFixed(2),
      line.matched_posting_id ? "Yes" : "No",
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            <Link href="/bank-reconciliation" className="text-primary print:hidden">
              Bank &amp; Cash Reconciliation
            </Link>
            <span className="hidden print:inline">Bank &amp; Cash Reconciliation</span> / {reconciliation.period_end}
          </span>
          <div className="flex items-center gap-2 print:hidden">
            {allLines.length > 0 && (
              <ExportCsvButton csv={csv} filename={`bank-reconciliation-${reconciliation.period_end}.csv`} />
            )}
            <PrintButton>Print / Save as PDF</PrintButton>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-extrabold text-ink">Reconciliation as of {reconciliation.period_end}</h1>
          <ReconciliationStatusBadge status={reconciliation.status} />
        </div>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <tbody>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Book balance (cash &amp; bank, per ledger)</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(bookBalance)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>+ Bank items not yet in the books</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(unmatchedBankEffect)}</td>
            </tr>
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>= Adjusted book balance</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(adjustedBookBalance)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Statement ending balance</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(statementBalance)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>+ Book items not yet cleared by the bank</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(unmatchedBookEffect)}</td>
            </tr>
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>= Adjusted bank balance</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(adjustedBankBalance)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${tdClass} font-extrabold text-ink`}>Difference</td>
              <td className={`${tdClass} text-right font-extrabold ${isBalanced ? "text-good" : "text-bad"}`}>
                {formatKobo(difference < 0n ? -difference : difference)} {isBalanced ? "— balanced" : "— review below"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {reconciliation.status === "in_progress" && canManage && (
        <div className="rounded-card border border-border bg-surface p-6 print:hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a statement line</span>
          <div className="mt-3">
            <StatementLineForm reconciliationId={reconciliation.id} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Statement lines not yet matched to the books
        </span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Date</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Amount</th>
                {canManage && reconciliation.status === "in_progress" && <th className={`${thClass} print:hidden`}></th>}
              </tr>
            </thead>
            <tbody>
              {unmatchedLines.length > 0 ? (
                unmatchedLines.map((line) => (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{line.line_date}</td>
                    <td className={`${tdClass} text-ink`}>{line.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>
                      {line.type === "deposit" ? "+" : "-"}
                      {formatKobo(BigInt(line.amount_kobo))}
                    </td>
                    {canManage && reconciliation.status === "in_progress" && (
                      <td className={`${tdClass} text-right print:hidden`}>
                        {unmatchedPostings.length > 0 ? (
                          <form action={matchStatementLine} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="line_id" value={line.id} />
                            <input type="hidden" name="reconciliation_id" value={reconciliation.id} />
                            <select
                              name="posting_id"
                              defaultValue=""
                              className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-primary"
                            >
                              <option value="" disabled>
                                Match to…
                              </option>
                              {unmatchedPostings.map((posting) => (
                                <option key={posting.id} value={posting.id}>
                                  {postingLabel(posting.id)}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="text-[12px] font-bold text-primary">
                              Match
                            </button>
                          </form>
                        ) : (
                          <span className="text-[12px] text-ink-soft">No unmatched ledger postings</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage && reconciliation.status === "in_progress" ? 4 : 3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    Every statement line is matched.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Ledger postings not yet cleared by the bank
        </span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Date</th>
                <th className={`${thClass} text-left`}>Memo</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {unmatchedPostings.length > 0 ? (
                unmatchedPostings.map((posting) => {
                  const entry = journalEntryById.get(posting.journal_entry_id);
                  return (
                    <tr key={posting.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} text-ink-soft`}>{entry?.entry_date ?? "—"}</td>
                      <td className={`${tdClass} text-ink`}>{entry?.memo ?? "—"}</td>
                      <td className={`${tdClass} text-right text-ink`}>
                        {posting.direction === "debit" ? "+" : "-"}
                        {formatKobo(BigInt(posting.amount_kobo))}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    Every posting up to this date is matched to a statement line.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {matchedLines.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Matched</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Statement line</th>
                  <th className={`${thClass} text-left`}>Matched ledger posting</th>
                  {canManage && reconciliation.status === "in_progress" && <th className={`${thClass} print:hidden`}></th>}
                </tr>
              </thead>
              <tbody>
                {matchedLines.map((line) => (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink`}>
                      {line.line_date} · {line.description} · {line.type === "deposit" ? "+" : "-"}
                      {formatKobo(BigInt(line.amount_kobo))}
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{postingLabel(line.matched_posting_id)}</td>
                    {canManage && reconciliation.status === "in_progress" && (
                      <td className={`${tdClass} text-right print:hidden`}>
                        <form action={unmatchStatementLine.bind(null, line.id, reconciliation.id)}>
                          <button type="submit" className="text-[12px] font-bold text-bad">
                            Unmatch
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reconciliation.status === "in_progress" && canManage && (
        <form action={completeReconciliation.bind(null, reconciliation.id)} className="flex justify-end print:hidden">
          <button
            type="submit"
            className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
          >
            Complete reconciliation
          </button>
        </form>
      )}
    </div>
  );
}
