import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { FixedAssetStatusBadge } from "@/components/Badge";
import { DisposeForm } from "./DisposeForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

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
      membership.role !== "auditor")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const { data: asset } = await supabase.from("fixed_assets").select("*").eq("id", id).single();
  if (!asset) notFound();

  const depreciableBase = BigInt(asset.cost_kobo) - BigInt(asset.salvage_value_kobo);
  const bookValue = BigInt(asset.cost_kobo) - BigInt(asset.accumulated_depreciation_kobo);
  const monthlyDepreciation = depreciableBase / BigInt(asset.useful_life_months);

  const { data: lines } = await supabase
    .from("depreciation_lines")
    .select("amount_kobo, depreciation_runs(period_end)")
    .eq("asset_id", id)
    .order("created_at");

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
        <p className="text-[13px] text-ink-soft">{asset.category ?? "Uncategorized"}</p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <tbody>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Acquisition date</td>
              <td className={`${tdClass} text-right text-ink`}>{asset.acquisition_date}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Cost</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.cost_kobo))}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Salvage value</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.salvage_value_kobo))}</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Useful life</td>
              <td className={`${tdClass} text-right text-ink`}>{asset.useful_life_months} months</td>
            </tr>
            <tr className="border-b border-border">
              <td className={`${tdClass} text-ink-soft`}>Straight-line monthly depreciation</td>
              <td className={`${tdClass} text-right text-ink`}>{formatKobo(monthlyDepreciation)}</td>
            </tr>
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

      {canManage && asset.status === "active" && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Dispose of this asset</span>
          <div className="mt-3">
            <DisposeForm assetId={asset.id} />
          </div>
        </div>
      )}
    </div>
  );
}
