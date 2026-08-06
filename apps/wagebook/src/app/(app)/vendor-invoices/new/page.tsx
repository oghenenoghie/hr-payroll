import { redirect } from "next/navigation";
import Link from "next/link";
import { NG_2026_1 } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { VendorInvoiceForm } from "./VendorInvoiceForm";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];

export default async function NewVendorInvoicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    redirect("/vendor-invoices");
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("org_id", membership.orgId)
    .order("name");

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendor Invoices</span>
        <h1 className="text-[22px] font-extrabold text-ink">New vendor invoice</h1>
        <p className="text-[13px] text-ink-soft">
          VAT and WHT are computed from rule version {NG_2026_1.id} and stored on the invoice — a later rate change
          never rewrites an already-created invoice.
        </p>
      </header>

      {vendors && vendors.length > 0 ? (
        <div className="rounded-card border border-border bg-surface p-6">
          <VendorInvoiceForm vendors={vendors} />
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface p-6 text-[13px] text-ink-soft">
          Add a vendor first. <Link href="/vendors" className="font-bold text-primary">Go to Vendors</Link>
        </div>
      )}
    </div>
  );
}
