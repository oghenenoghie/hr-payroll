import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorInvoiceStatusBadge } from "@/components/Badge";
import { updateVendorInvoiceStatus } from "../actions";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];
const VIEW_ROLES = [...MANAGE_ROLES, "auditor"];

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <p className="mt-1 text-[17px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

function StatusButton({ invoiceId, status, label }: { invoiceId: string; status: string; label: string }) {
  return (
    <form action={updateVendorInvoiceStatus.bind(null, invoiceId, status)}>
      <button
        type="submit"
        className="rounded-button border border-border bg-surface px-[16px] py-[9px] text-[12.5px] font-bold text-ink"
      >
        {label}
      </button>
    </form>
  );
}

export default async function VendorInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: invoice } = await supabase
    .from("vendor_invoices")
    .select("*, vendors(name, tin, email, bank_name, bank_account_number, bank_account_name)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/vendor-invoices" className="text-[12px] font-bold text-primary">
          ← Vendor Invoices
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold text-ink">{invoice.vendors?.name ?? "Vendor invoice"}</h1>
          <VendorInvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="text-[13px] text-ink-soft">
          {invoice.invoice_number ? `Invoice ${invoice.invoice_number} · ` : ""}
          {invoice.invoice_date} · Rule version {invoice.rule_version_id}
        </p>
        <p className="text-[13px] text-ink-soft">{invoice.description}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Subtotal" value={formatKobo(BigInt(invoice.subtotal_kobo))} />
        <SummaryTile
          label={`VAT${invoice.vat_exempt ? " (exempt)" : ""}`}
          value={formatKobo(BigInt(invoice.vat_kobo))}
        />
        <SummaryTile label="Invoice total" value={formatKobo(BigInt(invoice.invoice_total_kobo))} />
        <SummaryTile label="WHT withheld" value={`−${formatKobo(BigInt(invoice.wht_kobo))}`} />
        <SummaryTile label="Net payable to vendor" value={formatKobo(BigInt(invoice.net_payable_kobo))} />
        <SummaryTile label="WHT category" value={invoice.wht_category.replace(/_/g, " ")} />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendor</span>
        <p className="mt-1 text-[13px] text-ink">
          {invoice.vendors?.tin ? `TIN ${invoice.vendors.tin}` : "TIN not on file"}
          {invoice.vendors?.email ? ` · ${invoice.vendors.email}` : ""}
        </p>
        {invoice.vendors?.bank_name && (
          <p className="text-[13px] text-ink-soft">
            {invoice.vendors.bank_name} · {invoice.vendors.bank_account_number} · {invoice.vendors.bank_account_name}
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {invoice.status === "draft" && <StatusButton invoiceId={invoice.id} status="issued" label="Mark issued" />}
          {invoice.status === "issued" && <StatusButton invoiceId={invoice.id} status="paid" label="Mark paid" />}
          {invoice.status !== "void" && invoice.status !== "paid" && (
            <StatusButton invoiceId={invoice.id} status="void" label="Void" />
          )}
        </div>
      )}
    </div>
  );
}
