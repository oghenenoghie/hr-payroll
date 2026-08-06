import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorInvoiceStatusBadge } from "@/components/Badge";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];
const VIEW_ROLES = [...MANAGE_ROLES, "auditor"];

export default async function VendorInvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !VIEW_ROLES.includes(membership.role)) {
    redirect("/dashboard");
  }

  const canManage = MANAGE_ROLES.includes(membership.role);

  const { data: invoices } = await supabase
    .from("vendor_invoices")
    .select("id, invoice_number, invoice_date, description, subtotal_kobo, vat_kobo, wht_kobo, net_payable_kobo, status, vendors(name)")
    .order("invoice_date", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendor Invoices</span>
          <h1 className="text-[22px] font-extrabold text-ink">VAT and WHT computed automatically</h1>
          <p className="text-[13px] text-ink-soft">
            Every invoice runs the versioned VAT and WHT rule set — see the Compliance Engine page for the current
            rates.
          </p>
        </div>
        {canManage && (
          <Link
            href="/vendor-invoices/new"
            className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            + New invoice
          </Link>
        )}
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>Invoice</th>
              <th className={`${thClass} text-left`}>Date</th>
              <th className={`${thClass} text-right`}>Subtotal</th>
              <th className={`${thClass} text-right`}>VAT</th>
              <th className={`${thClass} text-right`}>WHT</th>
              <th className={`${thClass} text-right`}>Net payable</th>
              <th className={`${thClass} text-left`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>
                    <Link href={`/vendor-invoices/${invoice.id}`} className="text-primary">
                      {invoice.vendors?.name ?? "—"}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-ink-soft`}>{invoice.invoice_number ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{invoice.invoice_date}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(invoice.subtotal_kobo))}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(invoice.vat_kobo))}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(invoice.wht_kobo))}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>
                    {formatKobo(BigInt(invoice.net_payable_kobo))}
                  </td>
                  <td className={tdClass}>
                    <VendorInvoiceStatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No vendor invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
