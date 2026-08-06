"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];

export type CreateVendorState = { error?: string; success?: boolean } | null;

export async function createVendor(
  _prevState: CreateVendorState,
  formData: FormData,
): Promise<CreateVendorState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to manage vendors." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a vendor name." };
  }

  const tin = String(formData.get("tin") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const bankAccountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const bankAccountName = String(formData.get("bank_account_name") ?? "").trim() || null;

  const { error } = await supabase.from("vendors").insert({
    org_id: membership.orgId,
    name,
    tin,
    email,
    phone,
    bank_name: bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name: bankAccountName,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "A vendor with this name already exists." : error.message,
    };
  }

  revalidatePath("/vendors");
  revalidatePath("/vendor-invoices");
  revalidatePath("/vendor-invoices/new");
  return { success: true };
}

export async function deleteVendor(vendorId: string) {
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

  await supabase.from("vendors").delete().eq("id", vendorId);

  revalidatePath("/vendors");
}
