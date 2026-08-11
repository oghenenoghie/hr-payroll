import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { CustomerInvoiceStatusBadge } from "@/components/Badge";
import { getSettledByInvoice, invoiceOutstandingKobo } from "@/lib/arap";

const detailRow = "flex items-center justify-between gap-3 border-b border-border py-2 text-[13px] last:border-b-0";

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
      .select("id, invoice_number, invoice_date, due_date, amount_kobo, description, status")
      .eq("customer_id", id)
      .order("invoice_date", { ascending: false }),
  ]);
  if (!customer) notFound();

  const issuedInvoices = (invoices ?? []).filter((i) => i.status === "issued");
  const paidInvoices = (invoices ?? []).filter((i) => i.status === "paid");
  const settledByInvoice = await getSettledByInvoice(
    supabase,
    issuedInvoices.map((i) => i.id),
  );

  // Total invoiced only counts what was actually posted to the ledger
  // (issued or paid) — a draft never recognized revenue and a void
  // invoice was cancelled before it did, so neither belongs in the
  // customer's real invoiced total.
  const totalInvoicedKobo = [...issuedInvoices, ...paidInvoices].reduce(
    (sum, invoice) => sum + BigInt(invoice.amount_kobo),
    0n,
  );
  const outstandingKobo = issuedInvoices.reduce(
    (sum, invoice) => sum + invoiceOutstandingKobo(invoice, settledByInvoice),
    0n,
  );
  const totalPaidKobo = totalInvoicedKobo - outstandingKobo;

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: payments } =
    invoiceIds.length > 0
      ? await supabase
          .from("customer_invoice_payments")
          .select("id, amount_kobo, payment_date, invoice_id")
          .in("invoice_id", invoiceIds)
          .order("payment_date", { ascending: false })
          .limit(20)
      : { data: [] };

  const invoiceNumberById = new Map((invoices ?? []).map((i) => [i.id, i.invoice_number]));

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Customers</span>
          <h1 className="text-[22px] font-extrabold text-ink">{customer.name}</h1>
          <p className="text-[13px] text-ink-soft">
            {customer.contact_email ?? customer.contact_phone ?? "No contact on file"}
          </p>
        </div>
      </header>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/invoices?customer_id=${customer.id}#raise-invoice`}
            className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            + Create Invoice
          </Link>
          <a href="#recent-invoices" className="text-[13px] font-bold text-primary">
            View invoices →
          </a>
          <a href="#payment-history" className="text-[13px] font-bold text-primary">
            View payments →
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total invoiced</span>
          <p className="mt-1 text-[18px] font-extrabold text-ink">{formatKobo(totalInvoicedKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total paid</span>
          <p className="mt-1 text-[18px] font-extrabold text-good">{formatKobo(totalPaidKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Outstanding</span>
          <p className={`mt-1 text-[18px] font-extrabold ${outstandingKobo > 0n ? "text-bad" : "text-ink"}`}>
            {formatKobo(outstandingKobo)}
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft"># Invoices</span>
          <p className="mt-1 text-[18px] font-extrabold text-ink">{invoices?.length ?? 0}</p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Customer details</span>
        <div className="mt-3">
          <div className={detailRow}>
            <span className="text-ink-soft">Contact email</span>
            <span className="font-bold text-ink">{customer.contact_email ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Contact phone</span>
            <span className="font-bold text-ink">{customer.contact_phone ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Billing address</span>
            <span className="font-bold text-ink">{customer.billing_address ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Status</span>
            <span className="font-bold capitalize text-ink">{customer.status}</span>
          </div>
        </div>
        {canManage && (
          <Link href="/customers" className="mt-3 inline-block text-[12.5px] font-bold text-primary">
            Edit from Customers →
          </Link>
        )}
      </div>

      <div id="recent-invoices" className="scroll-mt-4 rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Invoices</span>
        <div className="mt-3">
          {invoices && invoices.length > 0 ? (
            invoices.map((invoice) => (
              <div key={invoice.id} className={detailRow}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-ink">{invoice.invoice_number}</span>
                  <span className="text-[12px] text-ink-soft">{invoice.description}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-ink">{formatKobo(BigInt(invoice.amount_kobo))}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-soft">{invoice.invoice_date}</span>
                    <CustomerInvoiceStatusBadge status={invoice.status} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-soft">No invoices raised for this customer yet.</p>
          )}
        </div>
      </div>

      <div id="payment-history" className="scroll-mt-4 rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payment history</span>
        <div className="mt-3">
          {payments && payments.length > 0 ? (
            payments.map((payment) => (
              <div key={payment.id} className={detailRow}>
                <span className="text-ink-soft">{invoiceNumberById.get(payment.invoice_id) ?? "—"}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-ink-soft">{payment.payment_date}</span>
                  <span className="font-bold text-good">{formatKobo(BigInt(payment.amount_kobo))}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-soft">No payments recorded for this customer yet.</p>
          )}
        </div>
      </div>

      <Link href="/customers" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Customers
      </Link>
    </div>
  );
}
