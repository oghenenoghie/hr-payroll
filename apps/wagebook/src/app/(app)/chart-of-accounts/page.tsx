import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";
import { AccountForm } from "./AccountForm";
import { deleteAccount } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
const TYPE_LABEL: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export default async function ChartOfAccountsPage() {
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

  const { data: accounts } = await supabase.from("chart_of_accounts").select("*").order("code");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounting</span>
        <h1 className="text-[22px] font-extrabold text-ink">Chart of Accounts</h1>
        <p className="text-[13px] text-ink-soft">
          Every account payroll, final settlement and accounts payable post to, plus any custom accounts you add.
          System accounts (used by the code that generates postings) can&apos;t be deleted — everything else can be.
        </p>
      </header>

      {TYPE_ORDER.map((type) => {
        const rows = (accounts ?? []).filter((account) => account.type === type);
        if (rows.length === 0) return null;

        return (
          <div key={type} className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{TYPE_LABEL[type]}</span>
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${thClass} text-left`}>Code</th>
                    <th className={`${thClass} text-left`}>Name</th>
                    <th className={`${thClass} text-center`}>Source</th>
                    {canManage && <th className={thClass}></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-mono text-ink-soft`}>{account.code}</td>
                      <td className={`${tdClass} font-bold text-ink`}>{account.name}</td>
                      <td className={`${tdClass} text-center`}>
                        {account.is_system ? (
                          <Badge tone="neutral">System</Badge>
                        ) : (
                          <Badge tone="good">Custom</Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className={`${tdClass} text-right`}>
                          {!account.is_system && (
                            <form action={deleteAccount.bind(null, account.id)}>
                              <button type="submit" className="text-[12px] font-bold text-bad">
                                Delete
                              </button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a custom account</span>
          <div className="mt-3">
            <AccountForm />
          </div>
        </div>
      )}
    </div>
  );
}
