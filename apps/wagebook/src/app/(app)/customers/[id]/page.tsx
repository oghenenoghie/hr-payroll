import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { CustomerInvoiceStatusBadge } from "@/components/Badge";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const RECENT_INVOICE_COUNT = 15;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [{ data: customer }, { data: invoices }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("customer_invoices")
      .select("id, invoice_number, description, amount_kobo, invoice_date, due_date, status")
      .eq("customer_id", id)
      .order("invoice_date", { ascending: false })
      .limit(RECENT_INVOICE_COUNT),
  ]);
  if (!customer) notFound();

  // Outstanding balance mirrors /invoices' own derivation: amount minus
  // every payment and credit note posted against an issued invoice, never
  // a stored column. Draft/void invoices never posted anything, so they
  // don't participate in either total below.
  const issuedInvoiceIds = (invoices ?? []).filter((i) => i.status === "issued").map((i) => i.id);
  const [{ data: payments }, { data: creditNotes }] = await Promise.all([
    issuedInvoiceIds.length > 0
      ? supabase.from("customer_invoice_payments").select("invoice_id, amount_kobo").in("invoice_id", issuedInvoiceIds)
      : Promise.resolve({ data: [] }),
    issuedInvoiceIds.length > 0
      ? supabase.from("customer_credit_notes").select("invoice_id, amount_kobo").in("invoice_id", issuedInvoiceIds)
      : Promise.resolve({ data: [] }),
  ]);
  const settledByInvoice = new Map<string, bigint>();
  for (const p of payments ?? []) {
    settledByInvoice.set(p.invoice_id, (settledByInvoice.get(p.invoice_id) ?? 0n) + BigInt(p.amount_kobo));
  }
  for (const c of creditNotes ?? []) {
    settledByInvoice.set(c.invoice_id, (settledByInvoice.get(c.invoice_id) ?? 0n) + BigInt(c.amount_kobo));
  }

  const posted = (invoices ?? []).filter((i) => i.status === "issued" || i.status === "paid");
  const totalInvoicedKobo = posted.reduce((sum, i) => sum + BigInt(i.amount_kobo), 0n);
  const outstandingKobo = posted
    .filter((i) => i.status === "issued")
    .reduce((sum, i) => sum + (BigInt(i.amount_kobo) - (settledByInvoice.get(i.id) ?? 0n)), 0n);
  const settledKobo = totalInvoicedKobo - outstandingKobo;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold text-ink">{customer.name}</h1>
          <span
            className={`inline-block rounded-badge border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.03em] ${
              customer.status === "active" ? "border-good bg-good-tint text-good" : "border-border bg-bg text-ink-soft"
            }`}
          >
            {customer.status}
          </span>
        </div>
        <p className="text-[13px] text-ink-soft">
          {customer.contact_email ?? customer.contact_phone ?? "No contact on file"}
          {customer.billing_address ? ` · ${customer.billing_address}` : ""}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Invoiced (lifetime)</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(totalInvoicedKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Outstanding</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(outstandingKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Settled</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(settledKobo)}</p>
        </div>
      </div>

      {canManage && (
        <Link
          href={`/invoices?customer_id=${customer.id}#raise-invoice`}
          className="w-fit rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
        >
          Raise an invoice for {customer.name}
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Recent invoices ({(invoices ?? []).length})
        </span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Invoice #</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-left`}>Invoice date</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices && invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{invoice.invoice_number}</td>
                    <td className={`${tdClass} text-ink`}>{invoice.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(invoice.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{invoice.invoice_date}</td>
                    <td className={`${tdClass} text-center`}>
                      <CustomerInvoiceStatusBadge status={invoice.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No invoices raised for this customer yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link href="/customers" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Customers
      </Link>
    </div>
  );
}
