import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function DepreciationRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: run } = await supabase.from("depreciation_runs").select("*").eq("id", id).single();
  if (!run) notFound();

  const { data: lines } = await supabase
    .from("depreciation_lines")
    .select("amount_kobo, fixed_assets(id, name, category)")
    .eq("depreciation_run_id", id)
    .order("amount_kobo", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          <Link href="/fixed-assets/depreciation" className="text-primary">
            Depreciation Runs
          </Link>{" "}
          / {run.period_end}
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">Depreciation for period ending {run.period_end}</h1>
        <p className="text-[13px] text-ink-soft">
          One balanced journal entry — debit depreciation expense, credit accumulated depreciation — for the total
          below. See{" "}
          <Link href="/general-ledger" className="font-bold text-primary">
            General Ledger
          </Link>{" "}
          for the posting itself.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Asset</th>
              <th className={`${thClass} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines && lines.length > 0 ? (
              lines.map((line, index) => (
                <tr key={index} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink`}>
                    {line.fixed_assets ? (
                      <Link href={`/fixed-assets/${line.fixed_assets.id}`} className="font-bold text-primary">
                        {line.fixed_assets.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(line.amount_kobo))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No lines found.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${tdClass} font-extrabold text-ink`}>Total</td>
              <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(BigInt(run.total_amount_kobo))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
