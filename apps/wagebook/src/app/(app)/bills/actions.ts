"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Json } from "@plutus/core";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateBillState = { error?: string; success?: boolean; billNumber?: string } | null;

type DraftLine = { description?: unknown; quantity?: unknown; unit_price_kobo?: unknown; discount_kobo?: unknown };

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
  const billDate = String(formData.get("bill_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();

  if (!vendorId) {
    return { error: "Choose a vendor." };
  }
  if (!billDate) {
    return { error: "Enter a bill date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }

  // The line-item editor serializes its rows as JSON into this hidden
  // field — real validation and every total (subtotal/VAT/amount) happen
  // server-side in create_vendor_bill_with_lines, which never trusts a
  // client-submitted total; this is just enough of a client-side shape
  // check to fail with a clean message rather than a raw Postgres error.
  let lines: DraftLine[];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    lines = parsed;
  } catch {
    return { error: "Line items are malformed." };
  }
  if (lines.length === 0) {
    return { error: "Add at least one line item." };
  }
  if (lines.some((line) => !String(line?.description ?? "").trim())) {
    return { error: "Every line item needs a description." };
  }

  const { data, error } = await supabase.rpc("create_vendor_bill_with_lines", {
    p_org_id: membership.orgId,
    p_vendor_id: vendorId,
    p_bill_date: billDate,
    p_due_date: dueDate,
    p_description: description,
    p_lines: lines as unknown as Json,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bills");
  revalidatePath("/vendors");
  return { success: true, billNumber: data?.bill_number };
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
