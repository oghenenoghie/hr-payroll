import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { RunDepreciationForm } from "./RunDepreciationForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function DepreciationRunsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "accountant")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const { data: runs } = await supabase
    .from("depreciation_runs")
    .select("*")
    .order("period_end", { ascending: false });

  const csv = toCsv(
    ["Period End", "Total (NGN)"],
    (runs ?? []).map((run) => [run.period_end, toNaira(BigInt(run.total_amount_kobo)).toFixed(2)]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            <Link href="/fixed-assets" className="text-primary">
              Fixed Assets
            </Link>{" "}
            / Depreciation Runs
          </span>
          {runs && runs.length > 0 && <ExportCsvButton csv={csv} filename="depreciation-runs.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Depreciation Runs</h1>
        <p className="text-[13px] text-ink-soft">
          Straight-line only, one period at a time — like a pay run, each posts a single balanced journal entry
          covering every active asset that isn&apos;t already fully depreciated.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period end</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {runs && runs.length > 0 ? (
              runs.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{run.period_end}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(run.total_amount_kobo))}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/fixed-assets/depreciation/${run.id}`} className="text-[12px] font-bold text-primary">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No depreciation runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Run depreciation</span>
          <div className="mt-3">
            <RunDepreciationForm />
          </div>
        </div>
      )}
    </div>
  );
}
