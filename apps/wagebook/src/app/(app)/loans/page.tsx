import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { LoanStatusBadge } from "@/components/Badge";
import { approveLoan, rejectLoan } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function LoansPage() {
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

  const { data: loans } = await supabase
    .from("loans")
    .select("*, employees(full_name)")
    .order("created_at", { ascending: false });

  const pending = (loans ?? []).filter((l) => l.status === "pending");
  const rest = (loans ?? []).filter((l) => l.status !== "pending");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Loans &amp; Advances</span>
        <h1 className="text-[22px] font-extrabold text-ink">Requests, repayment schedules and payroll deductions</h1>
        <p className="text-[13px] text-ink-soft">
          Approved loans are deducted automatically from net pay in every pay run until fully repaid.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-right`}>Monthly repayment</th>
                  <th className={`${thClass} text-left`}>Reason</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{loan.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(loan.principal_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.monthly_repayment_kobo))}
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{loan.reason ?? "—"}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <form action={approveLoan.bind(null, loan.id)}>
                          <button type="submit" className="text-[12px] font-bold text-good">
                            Approve
                          </button>
                        </form>
                        <form action={rejectLoan.bind(null, loan.id)}>
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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All loans</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>Outstanding</th>
                <th className={`${thClass} text-right`}>Monthly repayment</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{loan.employees?.full_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(loan.principal_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.outstanding_kobo))}
                    </td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(loan.monthly_repayment_kobo))}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <LoanStatusBadge status={loan.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No loans yet.
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
