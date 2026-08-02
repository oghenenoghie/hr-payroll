import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { FixedAssetStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { AssetForm } from "./AssetForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function FixedAssetsPage() {
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

  const { data: assets } = await supabase.from("fixed_assets").select("*").order("acquisition_date", { ascending: false });

  const csv = toCsv(
    ["Asset", "Category", "Acquisition Date", "Cost (NGN)", "Accumulated Depreciation (NGN)", "Book Value (NGN)", "Status"],
    (assets ?? []).map((asset) => {
      const bookValue = BigInt(asset.cost_kobo) - BigInt(asset.accumulated_depreciation_kobo);
      return [
        asset.name,
        asset.category ?? "",
        asset.acquisition_date,
        toNaira(BigInt(asset.cost_kobo)).toFixed(2),
        toNaira(BigInt(asset.accumulated_depreciation_kobo)).toFixed(2),
        toNaira(bookValue).toFixed(2),
        asset.status,
      ];
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
          {assets && assets.length > 0 && <ExportCsvButton csv={csv} filename="fixed-assets.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Fixed Assets</h1>
        <p className="text-[13px] text-ink-soft">
          The asset register. Straight-line depreciation only, run manually one period at a time from{" "}
          <Link href="/fixed-assets/depreciation" className="font-bold text-primary">
            Depreciation Runs
          </Link>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Asset</th>
              <th className={`${thClass} text-left`}>Category</th>
              <th className={`${thClass} text-right`}>Cost</th>
              <th className={`${thClass} text-right`}>Book value</th>
              <th className={`${thClass} text-center`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {assets && assets.length > 0 ? (
              assets.map((asset) => {
                const bookValue = BigInt(asset.cost_kobo) - BigInt(asset.accumulated_depreciation_kobo);
                return (
                  <tr key={asset.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>
                      <Link href={`/fixed-assets/${asset.id}`} className="text-primary">
                        {asset.name}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{asset.category ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(asset.cost_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(bookValue)}</td>
                    <td className={`${tdClass} text-center`}>
                      <FixedAssetStatusBadge status={asset.status} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No fixed assets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a fixed asset</span>
          <div className="mt-3">
            <AssetForm />
          </div>
        </div>
      )}
    </div>
  );
}
