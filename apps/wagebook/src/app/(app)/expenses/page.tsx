import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ExpenseStatusBadge } from "@/components/Badge";
import { approveExpense, rejectExpense } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function ExpensesPage() {
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

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, employees(full_name)")
    .order("created_at", { ascending: false });

  const pending = (expenses ?? []).filter((e) => e.status === "pending");
  const rest = (expenses ?? []).filter((e) => e.status !== "pending");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Expense Reimbursement</span>
        <h1 className="text-[22px] font-extrabold text-ink">Claims, approvals and taxable/non-taxable handling</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a claim decides its tax treatment — taxable claims are added to chargeable income and re-taxed
          in the next pay run; non-taxable claims are paid out as pure cash.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending claims</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((expense) => (
                  <tr key={expense.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{expense.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(expense.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{expense.description}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <form action={approveExpense.bind(null, expense.id, true)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve · taxable
                          </button>
                        </form>
                        <form action={approveExpense.bind(null, expense.id, false)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve · non-taxable
                          </button>
                        </form>
                        <form action={rejectExpense.bind(null, expense.id)}>
                          <button type="submit" className="text-[12px] font-bold text-bad">
                            Reject
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All claims</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-center`}>Tax treatment</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((expense) => (
                  <tr key={expense.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{expense.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(expense.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{expense.description}</td>
                    <td className={`${tdClass} text-center text-ink-soft`}>
                      {expense.taxable === null ? "—" : expense.taxable ? "Taxable" : "Non-taxable"}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <ExpenseStatusBadge status={expense.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No expense claims yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
