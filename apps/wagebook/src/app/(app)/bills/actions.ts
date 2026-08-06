"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1, UnknownWhtCategoryError, computeVendorInvoiceTotals, naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateBillState = { error?: string; success?: boolean } | null;

export async function createVendorBill(_prevState: CreateBillState, formData: FormData): Promise<CreateBillState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to raise vendor bills." };
  }

  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  const billNumber = String(formData.get("bill_number") ?? "").trim() || null;
  const billDate = String(formData.get("bill_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const subtotalNaira = Number(formData.get("subtotal") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const vatCategory = String(formData.get("vat_category") ?? "standard").trim() || "standard";
  const whtCategory = String(formData.get("wht_category") ?? "").trim();

  if (!vendorId) {
    return { error: "Choose a vendor." };
  }
  if (!billDate) {
    return { error: "Enter a bill date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (!subtotalNaira || subtotalNaira <= 0) {
    return { error: "Enter a subtotal greater than zero." };
  }
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

  const { error } = await supabase.from("vendor_bills").insert({
    org_id: membership.orgId,
    vendor_id: vendorId,
    bill_number: billNumber,
    bill_date: billDate,
    due_date: dueDate,
    amount_kobo: Number(totals.invoiceTotalKobo),
    subtotal_kobo: Number(totals.subtotalKobo),
    vat_category: vatCategory,
    vat_kobo: Number(totals.vatKobo),
    vat_exempt: totals.vatExempt,
    wht_category: whtCategory,
    wht_kobo: Number(totals.whtKobo),
    net_payable_kobo: Number(totals.netPayableToVendorKobo),
    rule_version_id: ruleVersion.id,
    description,
    requested_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bills");
  return { success: true };
}

async function requireApprover() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    redirect("/bills");
  }

  return supabase;
}

export async function approveVendorBill(billId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("approve_vendor_bill", { p_bill_id: billId });
  revalidatePath("/bills");
}

export async function rejectVendorBill(billId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("reject_vendor_bill", { p_bill_id: billId });
  revalidatePath("/bills");
}

export async function payVendorBill(billId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("pay_vendor_bill", { p_bill_id: billId });
  revalidatePath("/bills");
}

export async function payVendorBillsBatch(billIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    redirect("/bills");
  }

  if (billIds.length === 0) {
    return;
  }

  await supabase.rpc("pay_vendor_bills_batch", { p_org_id: membership.orgId, p_bill_ids: billIds });
  revalidatePath("/bills");
}
