import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { getCachedDepartments } from "@/lib/reference-data";
import { formatKobo } from "@/lib/format";
import { FixedAssetStatusBadge } from "@/components/Badge";
import { DisposeForm } from "./DisposeForm";
import { TransferForm } from "./TransferForm";
import { RevalueForm } from "./RevalueForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const METHOD_LABEL: Record<string, string> = {
  straight_line: "Straight-line",
  declining_balance: "Declining balance",
};

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    (membership.role !== "admin" &&
      membership.role !== "payroll_manager" &&
      membership.role !== "accountant" &&
      membership.role !== "auditor" &&
      membership.role !== "finance_manager")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const [{ data: asset }, { data: lines }, { data: transfers }, { data: revaluations }, departments] = await Promise.all([
    supabase.from("fixed_assets").select("*, departments(name)").eq("id", id).single(),
    supabase.from("depreciation_lines").select("amount_kobo, depreciation_runs(period_end)").eq("asset_id", id).order("created_at"),
    supabase
      .from("asset_transfers")
      .select("id, transferred_at, note, from_department:departments!from_department_id(name), to_department:departments!to_department_id(name)")
      .eq("asset_id", id)
      .order("transferred_at", { ascending: false }),
    supabase
      .from("asset_revaluations")
      .select("id, revalued_at, adjustment_kobo, note")
      .eq("asset_id", id)
      .order("revalued_at", { ascending: false }),
    canManage ? getCachedDepartments(membership.orgId) : Promise.resolve([]),
  ]);
  if (!asset) notFound();

  const revaluationAdjustment = BigInt(asset.revaluation_adjustment_kobo);
  const depreciableBase = BigInt(asset.cost_kobo) + revaluationAdjustment - BigInt(asset.salvage_value_kobo);
  const bookValue = BigInt(asset.cost_kobo) + revaluationAdjustment - BigInt(asset.accumulated_depreciation_kobo);
  const monthlyDepreciation =
    asset.depreciation_method === "straight_line" ? depreciableBase / BigInt(asset.useful_life_months) : null;

  const disposalGainLoss =
    asset.status === "disposed" && asset.disposal_proceeds_kobo !== null
      ? BigInt(asset.disposal_proceeds_kobo) - bookValue
      : null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          <Link href="/fixed-assets" className="text-primary">
            Fixed Assets
          </Link>{" "}
          / {asset.name}
        </span>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-extrabold text-ink">{asset.name}</h1>
          <FixedAssetStatusBadge status={asset.status} />
        </div>
        <p className="text-[13px] text-ink-soft">
          {asset.category ?? "Uncategorized"}
          {asset.departments ? ` · ${asset.departments.name}` : ""}
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <tbody>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Acquisition date</td>
              <td className={`${tdClass} text-right text-ink`}>{asset.acquisition_date}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Depreciation method</td>
              <td className={`${tdClass} text-right text-ink`}>
                {METHOD_LABEL[asset.depreciation_method] ?? asset.depreciation_method}
                {asset.depreciation_method === "declining_balance" && asset.declining_balance_rate_percent
                  ? ` (${asset.declining_balance_rate_percent}% per year)`
                  : ""}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Department</td>
              <td className={`${tdClass} text-right text-ink`}>{asset.departments?.name ?? "Unassigned"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Cost</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.cost_kobo))}</td>
            </tr>
            {revaluationAdjustment !== 0n && (
              <tr className="border-b border-border">
                <td className={`${tdClass} text-ink-soft`}>Revaluation adjustment</td>
                <td className={`${tdClass} text-right text-ink`}>
                  {revaluationAdjustment > 0n ? "+" : "−"}
                  {formatKobo(revaluationAdjustment < 0n ? -revaluationAdjustment : revaluationAdjustment)}
                </td>
              </tr>
            )}
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Salvage value</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.salvage_value_kobo))}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Useful life</td>
              <td className={`${tdClass} text-right text-ink`}>{asset.useful_life_months} months</td>
            </tr>
            {monthlyDepreciation !== null && (
              <tr className="border-b border-border">
                <td className={`${tdClass} text-ink-soft`}>Straight-line monthly depreciation</td>
                <td className={`${tdClass} text-right text-ink`}>{formatKobo(monthlyDepreciation)}</td>
              </tr>
            )}
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Accumulated depreciation</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.accumulated_depreciation_kobo))}</td>
            </tr>
            <tr className="border-b-2 border-border">
              <td className={`${tdClass} font-bold text-ink`}>Book value</td>
              <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(bookValue)}</td>
            </tr>
            {asset.status === "disposed" && (
              <>
                <tr className="border-b border-border">
                  <td className={`${tdClass} text-ink-soft`}>Disposed on</td>
                  <td className={`${tdClass} text-right text-ink`}>{asset.disposed_at}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className={`${tdClass} text-ink-soft`}>Proceeds received</td>
                  <td className={`${tdClass} text-right text-ink`}>
                    {formatKobo(BigInt(asset.disposal_proceeds_kobo ?? 0))}
                  </td>
                </tr>
                {disposalGainLoss !== null && (
                  <tr>
                    <td className={`${tdClass} font-bold text-ink`}>
                      {disposalGainLoss >= 0n ? "Gain on disposal" : "Loss on disposal"}
                    </td>
                    <td
                      className={`${tdClass} text-right font-bold ${disposalGainLoss >= 0n ? "text-good" : "text-bad"}`}
                    >
                      {formatKobo(disposalGainLoss < 0n ? -disposalGainLoss : disposalGainLoss)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Depreciation history</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[400px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Period end</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines && lines.length > 0 ? (
                lines.map((line, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{line.depreciation_runs?.period_end ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(line.amount_kobo))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No depreciation posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {transfers && transfers.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Transfer history</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Date</th>
                  <th className={`${thClass} text-left`}>From</th>
                  <th className={`${thClass} text-left`}>To</th>
                  <th className={`${thClass} text-left`}>Note</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{transfer.transferred_at.slice(0, 10)}</td>
                    <td className={`${tdClass} text-ink`}>{transfer.from_department?.name ?? "Unassigned"}</td>
                    <td className={`${tdClass} text-ink`}>{transfer.to_department?.name ?? "Unassigned"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{transfer.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {revaluations && revaluations.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Revaluation history</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Date</th>
                  <th className={`${thClass} text-right`}>Adjustment</th>
                  <th className={`${thClass} text-left`}>Note</th>
                </tr>
              </thead>
              <tbody>
                {revaluations.map((revaluation) => {
                  const adjustment = BigInt(revaluation.adjustment_kobo);
                  return (
                    <tr key={revaluation.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} text-ink-soft`}>{revaluation.revalued_at.slice(0, 10)}</td>
                      <td className={`${tdClass} text-right font-bold ${adjustment >= 0n ? "text-good" : "text-bad"}`}>
                        {adjustment >= 0n ? "+" : "−"}
                        {formatKobo(adjustment < 0n ? -adjustment : adjustment)}
                      </td>
                      <td className={`${tdClass} text-ink-soft`}>{revaluation.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && asset.status === "active" && (
        <>
          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Transfer to another department</span>
            <div className="mt-3">
              <TransferForm assetId={asset.id} departments={departments} />
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Revalue this asset</span>
            <div className="mt-3">
              <RevalueForm assetId={asset.id} />
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Dispose of this asset</span>
            <div className="mt-3">
              <DisposeForm assetId={asset.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
