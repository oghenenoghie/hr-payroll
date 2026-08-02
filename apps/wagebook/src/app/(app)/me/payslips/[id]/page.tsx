import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { DerivationDetail, Row, RULE_VERSIONS } from "../../../payroll/[id]/PayslipTable";

export default async function MyPayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase.from("employees").select("id, full_name").eq("user_id", user.id).maybeSingle();
  if (!employee) redirect("/me");

  // Ownership, not role: this is a self-service page, so the only check
  // that matters is that the payslip belongs to the employee record
  // linked to this login — never another employee's, regardless of role.
  const { data: slip } = await supabase
    .from("payslips")
    .select("*, pay_runs(period_start, period_end, rule_version_id)")
    .eq("id", id)
    .eq("employee_id", employee.id)
    .maybeSingle();
  if (!slip) notFound();

  const ruleVersion = RULE_VERSIONS[slip.pay_runs?.rule_version_id ?? ""];

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/me/payslips" className="text-[13px] font-bold text-primary">
          ← Back
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>

      <div className="rounded-card border border-border bg-surface p-8 print:border-none print:p-0">
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payslip</span>
          <h1 className="text-[20px] font-extrabold text-ink">{employee.full_name}</h1>
          <p className="text-[13px] text-ink-soft">
            {slip.pay_runs?.period_start} – {slip.pay_runs?.period_end}
          </p>
        </div>

        <div className="flex flex-col gap-1 py-4">
          <Row label="Gross pay" value={formatKobo(BigInt(slip.gross_kobo))} />
          <Row label="Pension (employee)" value={`− ${formatKobo(BigInt(slip.pension_employee_kobo))}`} />
          <Row label="NHF" value={`− ${formatKobo(BigInt(slip.nhf_kobo))}`} />
          <Row label="PAYE" value={`− ${formatKobo(BigInt(slip.paye_kobo))}`} />
          <Row label="Net pay" value={formatKobo(BigInt(slip.net_kobo))} emphasis />
        </div>

        <div className="border-t border-border pt-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            How these figures were derived
          </span>
          <div className="mt-2">
            {ruleVersion ? (
              <DerivationDetail slip={slip} ruleVersion={ruleVersion} />
            ) : (
              <p className="text-[12.5px] text-ink-soft">Rule version not available for re-derivation in this build.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
