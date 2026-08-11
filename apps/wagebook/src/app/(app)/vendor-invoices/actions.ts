"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1, UnknownWhtCategoryError, computeVendorInvoiceTotals, naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];

export type CreateVendorInvoiceState = { error?: string } | null;

export async function createVendorInvoice(
  _prevState: CreateVendorInvoiceState,
  formData: FormData,
): Promise<CreateVendorInvoiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to raise vendor invoices." };
  }

  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  if (!vendorId) {
    return { error: "Select a vendor." };
  }

  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim() || null;
  const invoiceDate = String(formData.get("invoice_date") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const description = String(formData.get("description") ?? "").trim();
  if (!description) {
    return { error: "Describe what this invoice is for." };
  }

  const subtotalNaira = Number(formData.get("subtotal") ?? 0);
  if (!(subtotalNaira > 0)) {
    return { error: "Enter a subtotal greater than zero." };
  }

  const vatCategory = String(formData.get("vat_category") ?? "standard").trim() || "standard";
  const whtCategory = String(formData.get("wht_category") ?? "").trim();
  if (!whtCategory) {
    return { error: "Select a WHT category." };
  }

  const ruleVersion = NG_2026_1;
  let totals;
  try {
    totals = computeVendorInvoiceTotals({ subtotalKobo: naira(subtotalNaira), vatCategory, whtCategory }, ruleVersion);
  } catch (err) {
    if (err instanceof UnknownWhtCategoryError) {
      return { error: "Unrecognized WHT category." };
    }
    throw err;
  }

  const { error, data } = await supabase
    .from("vendor_invoices")
    .insert({
      org_id: membership.orgId,
      vendor_id: vendorId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      description,
      vat_category: vatCategory,
      wht_category: whtCategory,
      subtotal_kobo: Number(totals.subtotalKobo),
      vat_kobo: Number(totals.vatKobo),
      vat_exempt: totals.vatExempt,
      wht_kobo: Number(totals.whtKobo),
      invoice_total_kobo: Number(totals.invoiceTotalKobo),
      net_payable_kobo: Number(totals.netPayableToVendorKobo),
      rule_version_id: ruleVersion.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendor-invoices");
  redirect(`/vendor-invoices/${data.id}`);
}

const STATUS_TRANSITIONS = ["draft", "issued", "paid", "void"];

export async function updateVendorInvoiceStatus(invoiceId: string, status: string) {
  if (!STATUS_TRANSITIONS.includes(status)) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    return;
  }

  await supabase.from("vendor_invoices").update({ status }).eq("id", invoiceId);

  revalidatePath("/vendor-invoices");
  revalidatePath(`/vendor-invoices/${invoiceId}`);
}
