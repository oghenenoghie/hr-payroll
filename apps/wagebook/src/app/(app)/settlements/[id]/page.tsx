import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

function Row({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={negative ? "font-bold text-bad" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}

export default async function SettlementReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: settlement } = await supabase
    .from("final_settlements")
    .select("*, employees(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!settlement) notFound();

  // final_settlements doesn't itself store the statutory deduction
  // breakdown — that lives on the off-cycle payslip its pay run posted,
  // the same source computeSettlementPreview reads from before processing.
  const { data: slip } = await supabase
    .from("payslips")
    .select("pension_employee_kobo, nhf_kobo, paye_kobo")
    .eq("pay_run_id", settlement.pay_run_id)
    .eq("employee_id", settlement.employee_id)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            <Link href="/settlements" className="print:hidden">
              Final Settlement
            </Link>
            <span className="hidden print:inline">Final Settlement</span>
          </span>
          <span className="print:hidden">
            <PrintButton>Print / Save as PDF</PrintButton>
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">{settlement.employees?.full_name ?? "—"}</h1>
        <p className="text-[13px] text-ink-soft">Processed {settlement.created_at.slice(0, 10)}</p>
      </header>

      <div className="rounded-card border border-border bg-surface p-6 print:border-none print:p-0">
        <div className="flex flex-col gap-2 text-[13px]">
          <Row label={`Service (${Number(settlement.service_years)} completed years)`} value="" />
          {settlement.final_period_days_worked > 0 && (
            <Row
              label={`Final period regular pay — ${settlement.final_period_days_worked} days`}
              value={formatKobo(BigInt(settlement.final_period_gross_kobo))}
            />
          )}
          <Row label={`Leave payout — ${settlement.leave_days_paid} days`} value={formatKobo(BigInt(settlement.leave_payout_kobo))} />
          <Row label="Gratuity" value={formatKobo(BigInt(settlement.gratuity_kobo))} />
          <div className="flex items-baseline justify-between border-t border-border pt-2 font-bold text-ink">
            <span>Gross settlement</span>
            <span>
              {formatKobo(
                BigInt(settlement.final_period_gross_kobo) +
                  BigInt(settlement.leave_payout_kobo) +
                  BigInt(settlement.gratuity_kobo),
              )}
            </span>
          </div>
          {slip && BigInt(slip.pension_employee_kobo) > 0n && (
            <Row label="Pension (employee share)" value={`− ${formatKobo(BigInt(slip.pension_employee_kobo))}`} negative />
          )}
          {slip && BigInt(slip.nhf_kobo) > 0n && <Row label="NHF" value={`− ${formatKobo(BigInt(slip.nhf_kobo))}`} negative />}
          {slip && <Row label="PAYE" value={`− ${formatKobo(BigInt(slip.paye_kobo))}`} negative />}
          {settlement.loan_clearance_kobo > 0 && (
            <Row label="Loan clearance" value={`− ${formatKobo(BigInt(settlement.loan_clearance_kobo))}`} negative />
          )}
          <div className="flex items-baseline justify-between border-t border-border pt-2 text-[15px] font-extrabold text-ink">
            <span>Net settlement</span>
            <span>{formatKobo(BigInt(settlement.net_settlement_kobo))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
