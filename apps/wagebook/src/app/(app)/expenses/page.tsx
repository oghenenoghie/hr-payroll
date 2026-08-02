import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ExpenseStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { approveExpense, rejectExpense } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Pending is an actionable work queue — stays unbounded (naturally
  // small, capped by how many claims are actually awaiting a decision at
  // once). Only the settled history (approved/rejected) grows without
  // bound over the org's lifetime, so that's the part that's paginated.
  const [{ data: pendingRaw }, { data: restRaw, count }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount_kobo, description, taxable, status, employees(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, amount_kobo, description, taxable, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
  ]);

  const pending = pendingRaw ?? [];
  const rest = restRaw ?? [];

  const totalRest = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRest / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/expenses?page=${page}`;
  }

  const csv = toCsv(
    ["Employee", "Amount (NGN)", "Description", "Tax Treatment", "Status"],
    [...pending, ...rest].map((expense) => [
      expense.employees?.full_name ?? "—",
      toNaira(BigInt(expense.amount_kobo)).toFixed(2),
      expense.description,
      expense.taxable === null ? "" : expense.taxable ? "Taxable" : "Non-taxable",
      expense.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Expense Reimbursement</span>
          <ExportCsvButton csv={csv} filename="expense-claims.csv" label="Export this page (CSV)" />
        </div>
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
                        <ConfirmActionButton
                          action={approveExpense.bind(null, expense.id, true)}
                          label="Approve · taxable"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve this claim as taxable?"
                          confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be approved and added to chargeable income, re-taxed in the next pay run.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={approveExpense.bind(null, expense.id, false)}
                          label="Approve · non-taxable"
                          tone="primary"
                          className="text-[12px] font-bold text-good disabled:opacity-50"
                          confirmTitle="Approve this claim as non-taxable?"
                          confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be approved and paid out as pure cash in the next pay run.`}
                          confirmLabel="Approve"
                        />
                        <ConfirmActionButton
                          action={rejectExpense.bind(null, expense.id)}
                          label="Reject"
                          confirmTitle="Reject this claim?"
                          confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be rejected.`}
                          confirmLabel="Reject"
                        />
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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
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
                    No expense history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} claim{totalRest === 1 ? "" : "s"} total
            </span>
            <div className="flex gap-3">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                  ← Previous
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
              )}
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                  Next →
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
