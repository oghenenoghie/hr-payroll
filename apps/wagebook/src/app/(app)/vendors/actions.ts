"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

// 'accountant' has full Payroll Manager parity per
// 20260730000000_new_org_roles.sql ("everywhere payroll_manager appears
// in a role check, accountant is added alongside it") — vendors is one
// of the few tables that predates that migration and never got the
// widening applied, fixed here alongside the TIN column addition.
const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];

export type CreateVendorState = { error?: string; success?: boolean } | null;

export async function createVendor(_prevState: CreateVendorState, formData: FormData): Promise<CreateVendorState> {
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
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const bankAccountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const bankAccountName = String(formData.get("bank_account_name") ?? "").trim() || null;

  const { error } = await supabase.from("vendors").insert({
    org_id: membership.orgId,
    name,
    tin,
    contact_email: contactEmail,
    contact_phone: contactPhone,
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
  revalidatePath("/bills");
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
