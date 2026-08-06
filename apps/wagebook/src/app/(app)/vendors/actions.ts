"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

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
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to manage vendors." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a vendor name." };
  }

  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const bankAccountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const bankAccountName = String(formData.get("bank_account_name") ?? "").trim() || null;

  const { error } = await supabase.from("vendors").insert({
    org_id: membership.orgId,
    name,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    bank_name: bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name: bankAccountName,
  });

  if (error) {
    return { error: error.message };
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

  await supabase.from("vendors").delete().eq("id", vendorId);

  revalidatePath("/vendors");
}
