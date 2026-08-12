import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function SettlementsPage() {
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

  const { data: settlements } = await supabase
    .from("final_settlements")
    .select("*, employees(full_name)")
    .order("created_at", { ascending: false });

  const csv = toCsv(
    ["Employee", "Service (years)", "Leave Payout (NGN)", "Gratuity (NGN)", "Loan Clearance (NGN)", "Net Settlement (NGN)", "Processed"],
    (settlements ?? []).map((settlement) => [
      settlement.employees?.full_name ?? "—",
      Number(settlement.service_years),
      toNaira(BigInt(settlement.leave_payout_kobo)).toFixed(2),
      toNaira(BigInt(settlement.gratuity_kobo)).toFixed(2),
      toNaira(BigInt(settlement.loan_clearance_kobo)).toFixed(2),
      toNaira(BigInt(settlement.net_settlement_kobo)).toFixed(2),
      settlement.created_at.slice(0, 10),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Final Settlement</span>
          {settlements && settlements.length > 0 && <ExportCsvButton csv={csv} filename="final-settlements.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Processed settlements</h1>
        <p className="text-[13px] text-ink-soft">
          Start a new settlement from an employee&apos;s edit page once they&apos;re marked Terminated.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Employee</th>
              <th className={`${thClass} text-right`}>Service</th>
              <th className={`${thClass} text-right`}>Leave payout</th>
              <th className={`${thClass} text-right`}>Gratuity</th>
              <th className={`${thClass} text-right`}>Loan clearance</th>
              <th className={`${thClass} text-right`}>Net settlement</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {settlements && settlements.length > 0 ? (
              settlements.map((settlement) => (
                <tr key={settlement.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{settlement.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{Number(settlement.service_years)} yrs</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>
                    {formatKobo(BigInt(settlement.leave_payout_kobo))}
                  </td>
                  <td className={`${tdClass} text-right text-ink-soft`}>
                    {formatKobo(BigInt(settlement.gratuity_kobo))}
                  </td>
                  <td className={`${tdClass} text-right text-ink-soft`}>
                    {formatKobo(BigInt(settlement.loan_clearance_kobo))}
                  </td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>
                    {formatKobo(BigInt(settlement.net_settlement_kobo))}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/settlements/${settlement.id}`} className="text-[12px] font-bold text-primary">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No settlements processed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
