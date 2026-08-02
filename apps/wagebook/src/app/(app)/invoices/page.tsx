import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { CustomerInvoiceStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { InvoiceForm } from "./InvoiceForm";
import { IssuedInvoiceActions } from "./IssuedInvoiceActions";
import { issueCustomerInvoice, voidCustomerInvoice } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Draft/issued are an actionable work queue — every item needs to stay
  // visible, so that fetch is unbounded (naturally small, capped by how
  // many invoices are actually mid-workflow at once). Only the settled
  // history (paid/void) grows without bound over the org's lifetime, so
  // that's the part that's actually paginated.
  const [{ data: queue }, { data: settled, count }, { data: customers }] = await Promise.all([
    supabase
      .from("customer_invoices")
      .select("*, customers(name)")
      .in("status", ["draft", "issued"])
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_invoices")
      .select("*, customers(name)", { count: "exact" })
      .in("status", ["paid", "void"])
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
    supabase.from("customers").select("id, name").eq("status", "active").order("name"),
  ]);

  const drafts = (queue ?? []).filter((i) => i.status === "draft");
  const issued = (queue ?? []).filter((i) => i.status === "issued");
  const rest = settled ?? [];

  // Outstanding balance per issued invoice: amount minus every payment and
  // credit note posted against it so far (see the partial-payments
  // migration) — never a stored column, always derived on read, matching
  // this codebase's convention for every other derived figure (Budgets,
  // P&L). Depends on `issued` above, so it's a genuinely sequential
  // second round-trip rather than folded into the first Promise.all.
  const issuedInvoiceIds = issued.map((i) => i.id);
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
  function outstandingKobo(invoice: { id: string; amount_kobo: number }): bigint {
    return BigInt(invoice.amount_kobo) - (settledByInvoice.get(invoice.id) ?? 0n);
  }

  const totalSettled = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSettled / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/invoices?page=${page}`;
  }

  // Scoped to the actionable queue plus this page of settled history —
  // matches exactly what's on screen, never a separate full-history
  // re-query.
  const csv = toCsv(
    ["Customer", "Description", "Invoice Number", "Amount (NGN)", "Invoice Date", "Due Date", "Status"],
    [...drafts, ...issued, ...rest].map((invoice) => [
      invoice.customers?.name ?? "—",
      invoice.description,
      invoice.invoice_number ?? "",
      toNaira(BigInt(invoice.amount_kobo)).toFixed(2),
      invoice.invoice_date,
      invoice.due_date ?? "",
      invoice.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
          {(drafts.length > 0 || issued.length > 0 || rest.length > 0) && (
            <ExportCsvButton csv={csv} filename="customer-invoices.csv" label="Export queue + this page (CSV)" />
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Customer invoices</h1>
        <p className="text-[13px] text-ink-soft">
          Issuing an invoice posts revenue to the general ledger immediately; receiving payment settles the
          receivable against cash. Every step is a real, balanced journal entry — see the general ledger for the
          postings.
        </p>
        <div className="mt-1 flex gap-4">
          <Link href="/invoices/recurring" className="w-fit text-[12.5px] font-bold text-primary">
            Manage recurring invoices →
          </Link>
          <Link href="/invoices/aging" className="w-fit text-[12.5px] font-bold text-primary">
            View aging report →
          </Link>
        </div>
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
                          <ConfirmActionButton
                            action={issueCustomerInvoice.bind(null, invoice.id)}
                            label="Issue"
                            tone="primary"
                            className="text-[12px] font-bold text-good disabled:opacity-50"
                            confirmTitle="Issue this invoice?"
                            confirmMessage={`"${invoice.description}" to ${invoice.customers?.name ?? "this customer"} (${formatKobo(BigInt(invoice.amount_kobo))}) will be issued, debiting Accounts Receivable and crediting Sales Revenue immediately.`}
                            confirmLabel="Issue"
                          />
                          <ConfirmActionButton
                            action={voidCustomerInvoice.bind(null, invoice.id)}
                            label="Void"
                            confirmTitle="Void this invoice?"
                            confirmMessage={`"${invoice.description}" to ${invoice.customers?.name ?? "this customer"} will be voided. This draft was never posted, so nothing in the ledger changes.`}
                            confirmLabel="Void"
                          />
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
                  <th className={`${thClass} text-right`}>Outstanding</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  {canManage && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {issued.map((invoice) => {
                  const outstanding = outstandingKobo(invoice);
                  return (
                    <tr key={invoice.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>{invoice.customers?.name ?? "—"}</td>
                      <td className={`${tdClass} text-ink-soft`}>{invoice.description}</td>
                      <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(invoice.amount_kobo))}</td>
                      <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(outstanding)}</td>
                      <td className={`${tdClass} text-ink-soft`}>{invoice.due_date ?? "—"}</td>
                      {canManage && (
                        <td className={`${tdClass} text-right`}>
                          <IssuedInvoiceActions
                            invoiceId={invoice.id}
                            invoiceDescription={invoice.description}
                            customerName={invoice.customers?.name ?? "this customer"}
                            outstandingNaira={(Number(outstanding) / 100).toFixed(2)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Settled ({totalSettled} total)
        </span>
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages}
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
