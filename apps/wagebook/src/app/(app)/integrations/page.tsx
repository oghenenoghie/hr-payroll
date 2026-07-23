import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";
import { toggleBankConnection } from "./actions";

const BANK_LABEL: Record<string, string> = {
  gtbank: "GTBank",
  access_bank: "Access Bank",
  zenith_bank: "Zenith Bank",
};

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: connections } = await supabase
    .from("integration_connections")
    .select("provider, connected")
    .eq("org_id", membership.orgId);

  const connectedByProvider = new Map((connections ?? []).map((c) => [c.provider, c.connected]));

  const { data: activeEmployees } = await supabase
    .from("employees")
    .select("bank_account_number")
    .eq("status", "active");

  const totalActive = activeEmployees?.length ?? 0;
  const withBankDetails = (activeEmployees ?? []).filter((e) => e.bank_account_number).length;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Integrations</span>
        <h1 className="text-[22px] font-extrabold text-ink">Bank disbursement, accounting sync and open APIs</h1>
      </header>

      <div className="rounded-panel border border-warn bg-warn-tint px-4 py-3 text-[12.5px] font-bold text-warn">
        Demo integration — toggling a bank below never calls a real bank API, moves money, or generates a
        disbursement file. It&apos;s illustrative only, not a live connection.
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Bank disbursement</span>

        <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-[13px] text-ink-soft">
            Employee bank details on file (real data — required before any disbursement file could ever be
            generated)
          </span>
          <Link href="/employees" className="text-[13px] font-extrabold text-ink">
            {withBankDetails} of {totalActive} active employees
          </Link>
        </div>

        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Bank</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(BANK_LABEL).map(([provider, label]) => {
                const connected = connectedByProvider.get(provider) ?? false;
                return (
                  <tr key={provider} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{label}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge tone={connected ? "good" : "neutral"}>{connected ? "Connected" : "Not connected"}</Badge>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <form action={toggleBankConnection.bind(null, provider, connected)}>
                        <button type="submit" className="text-[12px] font-bold text-primary">
                          {connected ? "Disconnect" : "Connect"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Accounting sync &amp; open APIs
        </span>
        <div className="rounded-card border border-border bg-surface px-4 py-6 text-[13px] text-ink-soft">
          <p>
            Every pay run&apos;s general ledger — payroll expense, statutory payables, benefits, loans, overtime,
            all fully itemised — can be exported as a real CSV a bookkeeper imports into QuickBooks, Xero or Sage.
            Open the run from{" "}
            <Link href="/payroll" className="font-bold text-primary">
              Payroll Runs
            </Link>{" "}
            and use &quot;Export general ledger (CSV)&quot;.
          </p>
          <p className="mt-3">No live accounting-software API sync yet — this is a manual export, not a connection.</p>
        </div>
      </div>
    </div>
  );
}
