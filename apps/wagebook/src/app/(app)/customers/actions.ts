"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateCustomerState = { error?: string; success?: boolean } | null;

export async function createCustomer(_prevState: CreateCustomerState, formData: FormData): Promise<CreateCustomerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to manage customers." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a customer name." };
  }

  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const billingAddress = String(formData.get("billing_address") ?? "").trim() || null;

  const { error } = await supabase.from("customers").insert({
    org_id: membership.orgId,
    name,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    billing_address: billingAddress,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/invoices");
  return { success: true };
}

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("customers").delete().eq("id", customerId);

  revalidatePath("/customers");
}
