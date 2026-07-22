import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: payRuns } = await supabase
    .from("pay_runs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
          <h1 className="text-[22px] font-extrabold text-ink">Multi-frequency runs with full audit trail</h1>
        </div>
        <Link
          href="/payroll/new"
          className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
        >
          + Run payroll
        </Link>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-left`}>Frequency</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={`${thClass} text-right`}>Gross</th>
              <th className={`${thClass} text-right`}>Net</th>
              <th className={`${thClass} text-left`}>Rule version</th>
            </tr>
          </thead>
          <tbody>
            {payRuns && payRuns.length > 0 ? (
              payRuns.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-b-0 hover:bg-bg">
                  <td className={tdClass}>
                    <Link href={`/payroll/${run.id}`} className="font-bold text-primary">
                      {run.period_start} – {run.period_end}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-ink-soft capitalize`}>{run.frequency}</td>
                  <td className={`${tdClass} text-center text-ink`}>{run.employee_count}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(run.gross_kobo))}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(run.net_kobo))}</td>
                  <td className={`${tdClass} text-ink-soft`}>{run.rule_version_id}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No payroll runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
