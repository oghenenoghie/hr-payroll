import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { CustomerInvoiceStatusBadge } from "@/components/Badge";
import { InvoiceForm } from "./InvoiceForm";
import { issueCustomerInvoice, voidCustomerInvoice, receiveCustomerPayment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function InvoicesPage() {
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

  const { data: invoices } = await supabase
    .from("customer_invoices")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  const { data: customers } = await supabase.from("customers").select("id, name").eq("status", "active").order("name");

  const drafts = (invoices ?? []).filter((i) => i.status === "draft");
  const issued = (invoices ?? []).filter((i) => i.status === "issued");
  const rest = (invoices ?? []).filter((i) => i.status === "paid" || i.status === "void");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
        <h1 className="text-[22px] font-extrabold text-ink">Customer invoices</h1>
        <p className="text-[13px] text-ink-soft">
          Issuing an invoice posts revenue to the general ledger immediately; receiving payment settles the
          receivable against cash. Every step is a real, balanced journal entry — see the general ledger for the
          postings.
        </p>
      </header>

      {drafts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Drafts</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Customer</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-left`}>Invoice date</th>
                  {canManage && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {drafts.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{invoice.customers?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(invoice.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.invoice_date}</td>
                    {canManage && (
                      <td className={`${tdClass} text-right`}>
                        <div className="flex justify-end gap-2">
                          <form action={issueCustomerInvoice.bind(null, invoice.id)}>
                            <button type="submit" className="text-[12px] font-bold text-good">
                              Issue
                            </button>
                          </form>
                          <form action={voidCustomerInvoice.bind(null, invoice.id)}>
                            <button type="submit" className="text-[12px] font-bold text-bad">
                              Void
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {issued.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Issued — awaiting payment
          </span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Customer</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  {canManage && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {issued.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{invoice.customers?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(invoice.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.due_date ?? "—"}</td>
                    {canManage && (
                      <td className={`${tdClass} text-right`}>
                        <form action={receiveCustomerPayment.bind(null, invoice.id)}>
                          <button type="submit" className="text-[12px] font-bold text-primary">
                            Record payment
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All settled</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Customer</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{invoice.customers?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(invoice.amount_kobo))}</td>
                    <td className={`${tdClass} text-center`}>
                      <CustomerInvoiceStatusBadge status={invoice.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No paid or void invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Raise an invoice</span>
          <div className="mt-3">
            <InvoiceForm customers={customers ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
