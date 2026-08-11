import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { InvoiceStatusBadge } from "@/components/Badge";
import { markInvoicePaid } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function formatNaira(kobo: number) {
  return `₦${toNaira(BigInt(kobo)).toLocaleString("en-NG")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", { dateStyle: "medium" });
}

export default async function BillingPage() {
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

  const { data: estimateRows } = await supabase.rpc("get_current_billing_estimate", { p_org_id: membership.orgId });
  const estimate = estimateRows?.[0] ?? null;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount_kobo, status, issued_at, due_at, paid_at, billing_periods(period_start, period_end, metered_employee_count)")
    .eq("org_id", membership.orgId)
    .order("issued_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Billing &amp; Subscription</span>
        <h1 className="text-[22px] font-extrabold text-ink">Plan usage and invoices</h1>
        <p className="text-[13px] text-ink-soft">
          Per-employee-per-month billing. Each period is metered from the workforce that was active or suspended at
          any point during it — an employee who exits mid-month still counts for that month.
        </p>
      </header>

      {estimate ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Plan</span>
            <p className="mt-1 text-[20px] font-extrabold text-ink">{estimate.plan_name}</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              {formatNaira(estimate.price_per_employee_kobo)} / employee / month
              {estimate.max_employees ? ` · up to ${estimate.max_employees} employees` : ""}
            </p>
          </div>
          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
              Current period ({formatDate(estimate.period_start)} – {formatDate(estimate.period_end)})
            </span>
            <p className="mt-1 text-[22px] font-extrabold text-ink">{estimate.metered_employee_count}</p>
            <p className="mt-1 text-[11px] text-ink-soft">billable employees, running count</p>
          </div>
          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Estimated charge</span>
            <p className="mt-1 text-[22px] font-extrabold text-ink">{formatNaira(estimate.estimated_amount_kobo)}</p>
            <p className="mt-1 text-[11px] text-ink-soft">not yet invoiced — the period is still open</p>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface px-4 py-6 text-center text-[13px] text-ink-soft">
          No active subscription found for this organization.
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-left`}>Status</th>
              <th className={`${thClass} text-left`}>Due</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>
                    {invoice.billing_periods
                      ? `${formatDate(invoice.billing_periods.period_start)} – ${formatDate(invoice.billing_periods.period_end)}`
                      : "—"}
                  </td>
                  <td className={`${tdClass} text-center text-ink-soft`}>
                    {invoice.billing_periods?.metered_employee_count ?? "—"}
                  </td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatNaira(invoice.amount_kobo)}</td>
                  <td className={tdClass}>
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className={`${tdClass} text-ink-soft`}>{formatDate(invoice.due_at)}</td>
                  <td className={`${tdClass} text-right`}>
                    {invoice.status === "issued" && (
                      <form action={markInvoicePaid.bind(null, invoice.id)}>
                        <button type="submit" className="text-[12px] font-bold text-primary">
                          Mark paid
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No invoices issued yet — the first one is generated when the current period closes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
