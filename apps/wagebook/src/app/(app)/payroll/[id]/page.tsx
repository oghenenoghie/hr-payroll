import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { ACCOUNT_LABEL, FREQUENCY_LABEL } from "@/lib/accounts";
import { PayRunStatusBadge } from "@/components/Badge";
import { PayslipTable } from "./PayslipTable";
import { ReversalForm } from "./ReversalForm";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  const { data: payRun } = await supabase.from("pay_runs").select("*").eq("id", id).maybeSingle();
  if (!payRun) notFound();

  const { data: reversal } =
    payRun.status === "reversed"
      ? await supabase.from("pay_run_reversals").select("reason, created_at").eq("pay_run_id", id).maybeSingle()
      : { data: null };

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
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold text-ink">
              {payRun.period_start} – {payRun.period_end}
            </h1>
            <PayRunStatusBadge status={payRun.status} />
          </div>
          <p className="text-[13px] capitalize text-ink-soft">
            {FREQUENCY_LABEL[payRun.frequency] ?? payRun.frequency} · {payRun.employee_count} employees ·{" "}
            {payRun.rule_version_id}
          </p>
        </div>
        {journalEntry && (
          <a
            href={`/payroll/${id}/export`}
            className="whitespace-nowrap rounded-button border border-border px-[18px] py-[10px] text-[12.5px] font-extrabold text-ink"
          >
            Export general ledger (CSV)
          </a>
        )}
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

      {reversal && (
        <div className="rounded-card border border-bad bg-bad-tint p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-bad">Reversed</span>
          <p className="mt-2 text-[13px] text-ink">{reversal.reason}</p>
          <p className="mt-1 text-[12px] text-ink-soft">{new Date(reversal.created_at).toLocaleString()}</p>
        </div>
      )}

      {payRun.status === "posted" && membership?.role === "admin" && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Reverse this run</span>
          <div className="mt-3">
            <ReversalForm payRunId={payRun.id} />
          </div>
        </div>
      )}

      <PayslipTable payslips={payslips ?? []} ruleVersionId={payRun.rule_version_id} />
    </div>
  );
}
