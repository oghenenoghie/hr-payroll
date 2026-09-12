import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { ACCOUNT_LABEL, FREQUENCY_LABEL } from "@/lib/accounts";
import { PayRunStatusBadge } from "@/components/Badge";
import { PayslipTable } from "./PayslipTable";
import { PayRunDraftActions } from "./PayRunDraftActions";
import { ReversalForm } from "./ReversalForm";
import { RecordRemittanceForm } from "./RecordRemittanceForm";
import { MarkPayRunPaidButton } from "./MarkPayRunPaidButton";
import { VarianceFlags } from "./VarianceFlags";

// The four schemes this build actually posts a liability for — matches
// /compliance and /reports's own "applied" set. ITF and WHT are
// "documented, not yet applied" and have no liability to remit against.
const REMITTANCE_SCHEME_ACCOUNT_CODES: Record<string, string> = {
  paye: "paye_payable",
  pension: "pension_payable",
  nhf: "nhf_payable",
  nsitf: "nsitf_payable",
};
const REMITTANCE_SCHEME_LABEL: Record<string, string> = {
  paye: "PAYE",
  pension: "Pension",
  nhf: "NHF",
  nsitf: "NSITF",
};
const REMITTANCE_ROLES = new Set(["admin", "payroll_manager", "finance_manager"]);

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

  const [{ data: reversal }, { data: payslips }, { data: journalEntry }] = await Promise.all([
    payRun.status === "reversed"
      ? supabase.from("pay_run_reversals").select("reason, created_at").eq("pay_run_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("payslips").select("*, employees(full_name)").eq("pay_run_id", id).order("created_at", { ascending: true }),
    supabase.from("journal_entries").select("id").eq("pay_run_id", id).maybeSingle(),
  ]);

  const { data: varianceFlags } = await supabase
    .from("pay_run_variance_flags")
    .select("id, flag_type, detail, acknowledged_by, acknowledged_at")
    .eq("pay_run_id", id)
    .order("created_at", { ascending: true });

  const { data: orgPostings } = journalEntry
    ? await supabase
        .from("ledger_postings")
        .select("account_code, direction, amount_kobo")
        .eq("journal_entry_id", journalEntry.id)
        .is("employee_id", null)
        .order("account_code")
    : { data: null };

  // The run's ORIGINAL journal entry specifically (earliest by
  // created_at) — not the single `journalEntry` above, which breaks once
  // a run is reversed (a reversed run has two journal_entries rows
  // sharing this pay_run_id, and .maybeSingle() errors on more than one).
  // Same "order by created_at asc limit 1" reverse_pay_run itself uses to
  // find the entry it's correcting.
  const { data: originalJournalEntries } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("pay_run_id", id)
    .order("created_at", { ascending: true })
    .limit(1);
  const originalJournalEntry = originalJournalEntries?.[0] ?? null;

  const [{ data: liabilityPostings }, { data: remittances }] = await Promise.all([
    originalJournalEntry
      ? supabase
          .from("ledger_postings")
          .select("account_code, amount_kobo")
          .eq("journal_entry_id", originalJournalEntry.id)
          .eq("direction", "credit")
          .in("account_code", Object.values(REMITTANCE_SCHEME_ACCOUNT_CODES))
      : Promise.resolve({ data: null }),
    supabase
      .from("statutory_remittances")
      .select("scheme, amount_kobo, remitted_on, reference, notes, created_at")
      .eq("pay_run_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const liabilityKoboByScheme = new Map<string, bigint>();
  for (const posting of liabilityPostings ?? []) {
    const scheme = Object.keys(REMITTANCE_SCHEME_ACCOUNT_CODES).find(
      (key) => REMITTANCE_SCHEME_ACCOUNT_CODES[key] === posting.account_code,
    );
    if (scheme) liabilityKoboByScheme.set(scheme, BigInt(posting.amount_kobo));
  }

  const remittancesByScheme = new Map<string, typeof remittances>();
  for (const remittance of remittances ?? []) {
    const existing = remittancesByScheme.get(remittance.scheme) ?? [];
    existing.push(remittance);
    remittancesByScheme.set(remittance.scheme, existing);
  }

  const schemesForRecording = [...liabilityKoboByScheme.keys()].map((scheme) => ({
    value: scheme,
    label: `${REMITTANCE_SCHEME_LABEL[scheme]} (${formatKobo(liabilityKoboByScheme.get(scheme)!)} posted)`,
  }));

  const remittedSchemesForReversal = [...remittancesByScheme.entries()].map(([scheme, rows]) => ({
    label: REMITTANCE_SCHEME_LABEL[scheme] ?? scheme,
    amountKobo: (rows ?? []).reduce((sum, r) => sum + BigInt(r.amount_kobo), 0n),
    remittedOn: (rows ?? [])[0]?.remitted_on ?? "",
  }));

  const canRecordRemittance = REMITTANCE_ROLES.has(membership?.role ?? "");

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
        {journalEntry && payRun.status !== "draft" && payRun.status !== "validated" && (
          <a
            href={`/payroll/${id}/export`}
            className="whitespace-nowrap rounded-button border border-border px-[18px] py-[10px] text-[12.5px] font-extrabold text-ink"
          >
            Export general ledger (CSV)
          </a>
        )}
      </header>

      {(payRun.status === "draft" || payRun.status === "validated") &&
        (membership?.role === "admin" || membership?.role === "payroll_manager" || membership?.role === "accountant") && (
        <div className="rounded-card border border-warn bg-warn-tint p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-warn">
            {payRun.status === "validated" ? "Validated — not yet locked" : "Draft — not yet posted"}
          </span>
          <div className="mt-3">
            <PayRunDraftActions payRunId={payRun.id} status={payRun.status} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <SummaryTile label="Gross" value={formatKobo(BigInt(payRun.gross_kobo))} />
        <SummaryTile label="Net" value={formatKobo(BigInt(payRun.net_kobo))} />
        <SummaryTile label="Employees" value={String(payRun.employee_count)} />
        <SummaryTile label="Rule version" value={payRun.rule_version_id} />
      </div>

      <VarianceFlags flags={varianceFlags ?? []} payRunStatus={payRun.status} />

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

      {liabilityKoboByScheme.size > 0 && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Statutory remittances
          </span>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            A record of what&apos;s actually been paid to each authority for this run — not a payment made by this
            system. Recording one here is what lets reversal warn you before correcting a liability that&apos;s
            already left the business.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {[...liabilityKoboByScheme.entries()].map(([scheme, liabilityKobo]) => {
              const recorded = remittancesByScheme.get(scheme) ?? [];
              return (
                <div key={scheme} className="rounded-panel border border-border bg-bg p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-bold text-ink">{REMITTANCE_SCHEME_LABEL[scheme]}</span>
                    <span className="text-[12.5px] text-ink-soft">{formatKobo(liabilityKobo)} posted</span>
                  </div>
                  {recorded.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {recorded.map((remittance) => (
                        <li key={remittance.created_at}>
                          <span className="inline-block rounded-badge bg-good-tint px-2 py-0.5 text-[12.5px] text-good">
                            {formatKobo(BigInt(remittance.amount_kobo))} remitted {remittance.remitted_on}
                            {remittance.reference ? ` · ${remittance.reference}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[12.5px] text-ink-soft">Not yet recorded</span>
                  )}
                </div>
              );
            })}
          </div>
          {canRecordRemittance && (
            <div className="mt-4 border-t border-border pt-4">
              <RecordRemittanceForm payRunId={payRun.id} schemes={schemesForRecording} />
            </div>
          )}
        </div>
      )}

      {reversal && (
        <div className="rounded-card border border-bad bg-bad-tint p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-bad">Reversed</span>
          <p className="mt-2 text-[13px] text-ink">{reversal.reason}</p>
          <p className="mt-1 text-[12px] text-ink-soft">{new Date(reversal.created_at).toLocaleString()}</p>
        </div>
      )}

      {payRun.status === "posted" && !payRun.disbursed_at && REMITTANCE_ROLES.has(membership?.role ?? "") && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Disbursement</span>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            A record that this run&apos;s pay was actually disbursed — not a payment made by this system.
          </p>
          <div className="mt-3">
            <MarkPayRunPaidButton payRunId={payRun.id} />
          </div>
        </div>
      )}

      {payRun.disbursed_at && (
        <div className="rounded-card border border-good bg-good-tint p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-good">Paid</span>
          <p className="mt-1 text-[12.5px] text-ink">{new Date(payRun.disbursed_at).toLocaleString()}</p>
        </div>
      )}

      {(payRun.status === "posted" || payRun.status === "validated") && membership?.role === "admin" && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Reverse this run</span>
          <div className="mt-3">
            <ReversalForm payRunId={payRun.id} remittedSchemes={remittedSchemesForReversal} />
          </div>
        </div>
      )}

      <PayslipTable payslips={payslips ?? []} ruleVersionId={payRun.rule_version_id} />
    </div>
  );
}
