import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { computeSettlementPreview, GRATUITY_DAYS_PER_YEAR_OF_SERVICE } from "./compute";
import { SettleForm } from "./SettleForm";

export default async function SettleEmployeePage({ params }: { params: Promise<{ id: string }> }) {
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

  const preview = await computeSettlementPreview(supabase, id);
  if (!preview) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Final Settlement</span>
        <h1 className="text-[22px] font-extrabold text-ink">{preview.employeeName}</h1>
        <p className="text-[13px] text-ink-soft">Exit payroll — gratuity, leave payout and loan clearance.</p>
      </header>

      {!preview.eligible ? (
        <div className="rounded-panel border border-bad bg-bad-tint px-4 py-3 text-[12.5px] font-bold text-bad">
          {preview.blockedReason}
        </div>
      ) : (
        <>
          <div className="rounded-panel border border-warn bg-warn-tint px-4 py-3 text-[12.5px] font-bold text-warn">
            Gratuity is calculated at {GRATUITY_DAYS_PER_YEAR_OF_SERVICE} days&apos; pay per completed year of
            service — a configurable company policy default, not a statutory rate.
          </div>

          <div className="rounded-card border border-border bg-surface p-6">
            <div className="flex flex-col gap-2 text-[13px]">
              <Row label={`Service (${preview.serviceYears} completed years)`} value="" />
              <Row label={`Leave payout — ${preview.leaveDaysPaid} days`} value={formatKobo(preview.leavePayoutKobo)} />
              <Row
                label={`Gratuity — ${preview.serviceYears * GRATUITY_DAYS_PER_YEAR_OF_SERVICE} days`}
                value={formatKobo(preview.gratuityKobo)}
              />
              <div className="flex items-baseline justify-between border-t border-border pt-2 font-bold text-ink">
                <span>Gross settlement</span>
                <span>{formatKobo(preview.grossSettlementKobo)}</span>
              </div>
              <Row label="PAYE" value={`− ${formatKobo(preview.payeKobo)}`} negative />
              {preview.loanClearanceKobo > 0n && (
                <Row
                  label={`Loan clearance (${preview.activeLoans.length} loan${preview.activeLoans.length === 1 ? "" : "s"})`}
                  value={`− ${formatKobo(preview.loanClearanceKobo)}`}
                  negative
                />
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-2 text-[15px] font-extrabold text-ink">
                <span>Net settlement</span>
                <span>{formatKobo(preview.netSettlementKobo)}</span>
              </div>
            </div>
          </div>

          <SettleForm employeeId={preview.employeeId} />
        </>
      )}
    </div>
  );
}

function Row({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={negative ? "font-bold text-bad" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}
