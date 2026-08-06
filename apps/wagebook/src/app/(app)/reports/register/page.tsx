import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { FREQUENCY_LABEL } from "@/lib/accounts";
import { Badge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function PayrollRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

  // Two independent requests: the current page of runs, and the
  // all-history "Totals" figures — the latter is a real database
  // aggregate (see get_payroll_register_totals), not a full-table
  // download summed in JavaScript, so paginating the list above it
  // doesn't touch its accuracy.
  const [payRunsResult, totalsResult] = await Promise.all([
    supabase
      .from("pay_runs")
      .select("id, period_start, period_end, frequency, status, gross_kobo, net_kobo, employee_count", {
        count: "exact",
      })
      .order("period_start", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
    membership ? supabase.rpc("get_payroll_register_totals", { p_org_id: membership.orgId }) : { data: null },
  ]);

  const payRuns = payRunsResult.data;
  const totalRuns = payRunsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRuns / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const totalsRow = totalsResult.data?.[0];
  const totals = {
    grossKobo: BigInt(totalsRow?.gross_kobo ?? 0),
    netKobo: BigInt(totalsRow?.net_kobo ?? 0),
    payeKobo: BigInt(totalsRow?.paye_kobo ?? 0),
    pensionKobo: BigInt(totalsRow?.pension_kobo ?? 0),
    nhfKobo: BigInt(totalsRow?.nhf_kobo ?? 0),
  };

  const payRunIds = (payRuns ?? []).map((run) => run.id);

  // Narrowed to just the runs on this page — previously these three
  // queries pulled every payslip/journal entry/posting in the org's
  // entire history just to render one page of 25 rows.
  const [{ data: payslips }, { data: journalEntries }] =
    payRunIds.length > 0
      ? await Promise.all([
          supabase
            .from("payslips")
            .select("pay_run_id, paye_kobo, pension_employee_kobo, pension_employer_kobo, nhf_kobo")
            .in("pay_run_id", payRunIds),
          supabase.from("journal_entries").select("id, pay_run_id").in("pay_run_id", payRunIds),
        ])
      : [{ data: [] }, { data: [] }];

  const journalEntryIds = (journalEntries ?? []).map((entry) => entry.id);
  const { data: postings } =
    journalEntryIds.length > 0
      ? await supabase.from("ledger_postings").select("journal_entry_id, direction, amount_kobo").in("journal_entry_id", journalEntryIds)
      : { data: [] };

  // One pass over payslips, keyed by pay_run_id — avoids a query per run.
  const liabilityByRun = new Map<string, { payeKobo: bigint; pensionKobo: bigint; nhfKobo: bigint }>();
  for (const slip of payslips ?? []) {
    const running = liabilityByRun.get(slip.pay_run_id) ?? { payeKobo: 0n, pensionKobo: 0n, nhfKobo: 0n };
    running.payeKobo += BigInt(slip.paye_kobo);
    running.pensionKobo += BigInt(slip.pension_employee_kobo) + BigInt(slip.pension_employer_kobo);
    running.nhfKobo += BigInt(slip.nhf_kobo);
    liabilityByRun.set(slip.pay_run_id, running);
  }

  // A run can have more than one journal entry once reversed (the
  // correcting entry shares the same pay_run_id) — reconciliation checks
  // every posting across all of them together, which is exactly the
  // point: a reversed run's ledger nets to zero, not just its original entry.
  const journalEntryIdsByRun = new Map<string, string[]>();
  for (const entry of journalEntries ?? []) {
    if (!entry.pay_run_id) continue;
    const list = journalEntryIdsByRun.get(entry.pay_run_id) ?? [];
    list.push(entry.id);
    journalEntryIdsByRun.set(entry.pay_run_id, list);
  }

  const debitsCreditsByJournalEntry = new Map<string, { debits: bigint; credits: bigint }>();
  for (const posting of postings ?? []) {
    const running = debitsCreditsByJournalEntry.get(posting.journal_entry_id) ?? { debits: 0n, credits: 0n };
    if (posting.direction === "debit") {
      running.debits += BigInt(posting.amount_kobo);
    } else {
      running.credits += BigInt(posting.amount_kobo);
    }
    debitsCreditsByJournalEntry.set(posting.journal_entry_id, running);
  }

  function isBalanced(payRunId: string): boolean {
    const entryIds = journalEntryIdsByRun.get(payRunId) ?? [];
    if (entryIds.length === 0) return true; // nothing posted yet, vacuously fine
    let debits = 0n;
    let credits = 0n;
    for (const entryId of entryIds) {
      const totals = debitsCreditsByJournalEntry.get(entryId) ?? { debits: 0n, credits: 0n };
      debits += totals.debits;
      credits += totals.credits;
    }
    return debits === credits;
  }

  // Scoped to this page, same as the table below — the all-history totals
  // above are already a separate, real aggregate, not something a CSV of
  // every run ever needs to re-derive from scratch on every page load.
  const csv = toCsv(
    ["Period Start", "Period End", "Frequency", "Employees", "Gross (NGN)", "Net (NGN)", "PAYE (NGN)", "Pension (NGN)", "NHF (NGN)", "Status", "Ledger"],
    (payRuns ?? []).map((run) => {
      const liability = liabilityByRun.get(run.id) ?? { payeKobo: 0n, pensionKobo: 0n, nhfKobo: 0n };
      return [
        run.period_start,
        run.period_end,
        FREQUENCY_LABEL[run.frequency] ?? run.frequency,
        run.employee_count,
        toNaira(BigInt(run.gross_kobo)).toFixed(2),
        toNaira(BigInt(run.net_kobo)).toFixed(2),
        toNaira(liability.payeKobo).toFixed(2),
        toNaira(liability.pensionKobo).toFixed(2),
        toNaira(liability.nhfKobo).toFixed(2),
        run.status,
        isBalanced(run.id) ? "Balanced" : "Out of balance",
      ];
    }),
  );

  function pageHref(page: number): string {
    return `/reports/register?page=${page}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Reports</span>
          {payRuns && payRuns.length > 0 && <ExportCsvButton csv={csv} filename="payroll-register.csv" label="Export this page (CSV)" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Payroll register &amp; reconciliation</h1>
        <p className="text-[13px] text-ink-soft">
          Every pay run with its statutory liability breakdown and a ledger-balanced check — draft and reversed runs
          are excluded from the totals row but still listed for the audit trail. The totals row always reflects
          every posted run in your org&apos;s history, not just this page.
        </p>
        <Link href="/reports" className="mt-1 text-[12.5px] font-bold text-primary">
          ← Back to Reports
        </Link>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-left`}>Frequency</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={`${thClass} text-right`}>Gross</th>
              <th className={`${thClass} text-right`}>Net</th>
              <th className={`${thClass} text-right`}>PAYE</th>
              <th className={`${thClass} text-right`}>Pension</th>
              <th className={`${thClass} text-right`}>NHF</th>
              <th className={`${thClass} text-center`}>Status</th>
              <th className={`${thClass} text-center`}>Ledger</th>
            </tr>
          </thead>
          <tbody>
            {payRuns && payRuns.length > 0 ? (
              payRuns.map((run) => {
                const liability = liabilityByRun.get(run.id) ?? { payeKobo: 0n, pensionKobo: 0n, nhfKobo: 0n };
                const balanced = isBalanced(run.id);
                return (
                  <tr key={run.id} className="border-b border-border last:border-b-0">
                    <td className={tdClass}>
                      <Link href={`/payroll/${run.id}`} className="font-bold text-primary">
                        {run.period_start} – {run.period_end}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-ink-soft capitalize`}>
                      {FREQUENCY_LABEL[run.frequency] ?? run.frequency}
                    </td>
                    <td className={`${tdClass} text-center text-ink`}>{run.employee_count}</td>
                    <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(run.gross_kobo))}</td>
                    <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(run.net_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(liability.payeKobo)}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(liability.pensionKobo)}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(liability.nhfKobo)}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge tone={run.status === "reversed" ? "bad" : run.status === "draft" ? "warn" : "good"}>
                        {run.status === "reversed" ? "Reversed" : run.status === "draft" ? "Draft" : "Posted"}
                      </Badge>
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Badge tone={balanced ? "good" : "bad"}>{balanced ? "Balanced" : "Out of balance"}</Badge>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No payroll runs yet.
                </td>
              </tr>
            )}
          </tbody>
          {totalRuns > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-bg">
                <td className={`${tdClass} font-extrabold text-ink`} colSpan={3}>
                  Totals (posted runs only, all history)
                </td>
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(totals.grossKobo)}</td>
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(totals.netKobo)}</td>
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(totals.payeKobo)}</td>
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(totals.pensionKobo)}</td>
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(totals.nhfKobo)}</td>
                <td className={tdClass} colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-soft">
            Page {currentPage} of {totalPages} · {totalRuns} run{totalRuns === 1 ? "" : "s"} total
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
  );
}
