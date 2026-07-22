import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { PayslipTable } from "./PayslipTable";

const ACCOUNT_LABEL: Record<string, string> = {
  nsitf_expense: "NSITF expense",
  nsitf_payable: "NSITF payable (due NSITF, before the 16th)",
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <p className="mt-1 text-[17px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default async function PayRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: payRun } = await supabase.from("pay_runs").select("*").eq("id", id).maybeSingle();
  if (!payRun) notFound();

  const { data: payslips } = await supabase
    .from("payslips")
    .select("*, employees(full_name)")
    .eq("pay_run_id", id)
    .order("created_at", { ascending: true });

  const { data: journalEntry } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("pay_run_id", id)
    .maybeSingle();

  const { data: orgPostings } = journalEntry
    ? await supabase
        .from("ledger_postings")
        .select("account_code, direction, amount_kobo")
        .eq("journal_entry_id", journalEntry.id)
        .is("employee_id", null)
        .order("account_code")
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
        <h1 className="text-[22px] font-extrabold text-ink">
          {payRun.period_start} – {payRun.period_end}
        </h1>
        <p className="text-[13px] capitalize text-ink-soft">
          {payRun.frequency} · {payRun.employee_count} employees · {payRun.rule_version_id}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <SummaryTile label="Gross" value={formatKobo(BigInt(payRun.gross_kobo))} />
        <SummaryTile label="Net" value={formatKobo(BigInt(payRun.net_kobo))} />
        <SummaryTile label="Employees" value={String(payRun.employee_count)} />
        <SummaryTile label="Rule version" value={payRun.rule_version_id} />
      </div>

      {orgPostings && orgPostings.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Employer statutory costs — not employee deductions
          </span>
          <div className="mt-3">
            {orgPostings
              .filter((posting) => posting.direction === "debit")
              .map((posting) => (
                <div
                  key={posting.account_code}
                  className="flex items-baseline justify-between border-b border-border py-[10px] last:border-b-0"
                >
                  <span className="text-[13px] text-ink-soft">
                    {ACCOUNT_LABEL[posting.account_code] ?? posting.account_code}
                  </span>
                  <span className="text-[13px] font-bold text-ink">{formatKobo(BigInt(posting.amount_kobo))}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <PayslipTable payslips={payslips ?? []} ruleVersionId={payRun.rule_version_id} />
    </div>
  );
}
