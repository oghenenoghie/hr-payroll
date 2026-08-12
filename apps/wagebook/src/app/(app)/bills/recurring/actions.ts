"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateRecurringBillState = { error?: string; success?: boolean } | null;

export async function createRecurringBill(
  _prevState: CreateRecurringBillState,
  formData: FormData,
): Promise<CreateRecurringBillState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to set up recurring bills." };
  }

  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);
  const cadence = String(formData.get("cadence") ?? "");
  const nextBillDate = String(formData.get("next_bill_date") ?? "").trim();

  if (!vendorId) {
    return { error: "Choose a vendor." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  if (!["weekly", "monthly", "quarterly", "annually"].includes(cadence)) {
    return { error: "Choose how often this bill repeats." };
  }
  if (!nextBillDate) {
    return { error: "Enter the next bill date." };
  }

  const { error } = await supabase.from("vendor_bill_templates").insert({
    org_id: membership.orgId,
    vendor_id: vendorId,
    description,
    amount_kobo: Number(naira(amountNaira)),
    cadence,
    next_bill_date: nextBillDate,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bills/recurring");
  return { success: true };
}

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    redirect("/bills/recurring");
  }

  return supabase;
}

export async function toggleRecurringBill(templateId: string, active: boolean) {
  const supabase = await requireManager();
  await supabase.from("vendor_bill_templates").update({ active }).eq("id", templateId);
  revalidatePath("/bills/recurring");
}

export async function deleteRecurringBill(templateId: string) {
  const supabase = await requireManager();
  await supabase.from("vendor_bill_templates").delete().eq("id", templateId);
  revalidatePath("/bills/recurring");
}
