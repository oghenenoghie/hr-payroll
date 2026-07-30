"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
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
  const amountNaira = Number(formData.get("amount") ?? 0);
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
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { error } = await supabase.from("vendor_bills").insert({
    org_id: membership.orgId,
    vendor_id: vendorId,
    bill_number: billNumber,
    bill_date: billDate,
    due_date: dueDate,
    amount_kobo: Number(naira(amountNaira)),
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
