import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";

export default async function PayRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();
  if (!membership) {
    redirect("/setup");
  }

  const { data: run } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, frequency, rule_version_id, employee_count, gross_kobo, net_kobo, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!run) {
    notFound();
  }

  const { data: payslips } = await supabase
    .from("payslips")
    .select(
      "id, gross_kobo, pension_employee_kobo, pension_employer_kobo, nhf_kobo, rent_relief_kobo, chargeable_income_kobo, paye_kobo, employee_deductions_kobo, net_kobo, employees(full_name)",
    )
    .eq("pay_run_id", id);

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <p className="label-micro mb-2">Payroll Runs</p>
        <h1 className="text-2xl font-extrabold mb-1">
          {run.period_start} → {run.period_end}
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mb-8">
          {run.frequency} · {run.rule_version_id} · {run.employee_count} employee{run.employee_count === 1 ? "" : "s"}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card">
            <p className="label-micro mb-2">Total gross</p>
            <p className="text-2xl font-extrabold">{formatKobo(run.gross_kobo)}</p>
          </div>
          <div className="card">
            <p className="label-micro mb-2">Total net</p>
            <p className="text-2xl font-extrabold">{formatKobo(run.net_kobo)}</p>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <p className="label-micro mb-4">Payslips</p>
          {!payslips || payslips.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No payslips on this run.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--border)]">
                  <th className="label-micro pb-2 pr-4">Employee</th>
                  <th className="label-micro pb-2 pr-4 text-right">Gross</th>
                  <th className="label-micro pb-2 pr-4 text-right">Pension (EE)</th>
                  <th className="label-micro pb-2 pr-4 text-right">NHF</th>
                  <th className="label-micro pb-2 pr-4 text-right">PAYE</th>
                  <th className="label-micro pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => {
                  const employee = payslip.employees as unknown as { full_name: string } | null;
                  return (
                    <tr key={payslip.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-3 pr-4 font-bold">{employee?.full_name ?? "—"}</td>
                      <td className="py-3 pr-4 text-right">{formatKobo(payslip.gross_kobo)}</td>
                      <td className="py-3 pr-4 text-right">{formatKobo(payslip.pension_employee_kobo)}</td>
                      <td className="py-3 pr-4 text-right">{formatKobo(payslip.nhf_kobo)}</td>
                      <td className="py-3 pr-4 text-right">{formatKobo(payslip.paye_kobo)}</td>
                      <td className="py-3 text-right font-extrabold">{formatKobo(payslip.net_kobo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
