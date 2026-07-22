import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";

export default async function PayrollRunsPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();

  if (!membership) {
    redirect("/setup");
  }

  const { data: runs } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, frequency, rule_version_id, employee_count, gross_kobo, net_kobo, created_at")
    .order("created_at", { ascending: false });

  const canRun = membership.role === "admin" || membership.role === "payroll_manager";

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="label-micro mb-2">Payroll Runs</p>
            <h1 className="text-2xl font-extrabold">{runs?.length ?? 0} run{runs?.length === 1 ? "" : "s"}</h1>
          </div>
          {canRun ? (
            <Link
              href="/payroll-runs/new"
              className="inline-block rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
            >
              Run payroll
            </Link>
          ) : null}
        </div>

        <div className="card overflow-x-auto">
          {!runs || runs.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No payroll runs yet.{" "}
              {canRun ? (
                <Link href="/payroll-runs/new" className="font-bold text-[var(--primary)]">
                  Run your first one
                </Link>
              ) : null}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--border)]">
                  <th className="label-micro pb-2 pr-4">Period</th>
                  <th className="label-micro pb-2 pr-4">Frequency</th>
                  <th className="label-micro pb-2 pr-4">Rule version</th>
                  <th className="label-micro pb-2 pr-4 text-right">Employees</th>
                  <th className="label-micro pb-2 pr-4 text-right">Gross</th>
                  <th className="label-micro pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="py-3 pr-4">
                      <Link href={`/payroll-runs/${run.id}`} className="font-bold text-[var(--primary)]">
                        {run.period_start} → {run.period_end}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--ink-soft)] capitalize">{run.frequency}</td>
                    <td className="py-3 pr-4 text-[var(--ink-soft)]">{run.rule_version_id}</td>
                    <td className="py-3 pr-4 text-right">{run.employee_count}</td>
                    <td className="py-3 pr-4 text-right font-bold">{formatKobo(run.gross_kobo)}</td>
                    <td className="py-3 text-right font-bold">{formatKobo(run.net_kobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
