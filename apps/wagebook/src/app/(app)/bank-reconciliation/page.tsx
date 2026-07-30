import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ReconciliationStatusBadge } from "@/components/Badge";
import { ReconciliationForm } from "./ReconciliationForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BankReconciliationPage() {
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

  const { data: reconciliations } = await supabase
    .from("bank_reconciliations")
    .select("*")
    .order("period_end", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
        <h1 className="text-[22px] font-extrabold text-ink">Bank &amp; Cash Reconciliation</h1>
        <p className="text-[13px] text-ink-soft">
          Match what the books say happened to cash against what the bank statement actually says, one statement
          period at a time. There&apos;s no live bank feed in this build — enter the ending balance from the actual
          statement, then work through matching individual lines on the next page.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period end</th>
              <th className={`${thClass} text-right`}>Statement balance</th>
              <th className={`${thClass} text-center`}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {reconciliations && reconciliations.length > 0 ? (
              reconciliations.map((reconciliation) => (
                <tr key={reconciliation.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{reconciliation.period_end}</td>
                  <td className={`${tdClass} text-right text-ink`}>
                    {formatKobo(BigInt(reconciliation.statement_balance_kobo))}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <ReconciliationStatusBadge status={reconciliation.status} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/bank-reconciliation/${reconciliation.id}`} className="text-[12px] font-bold text-primary">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No reconciliations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Start a reconciliation</span>
          <div className="mt-3">
            <ReconciliationForm />
          </div>
        </div>
      )}
    </div>
  );
}
