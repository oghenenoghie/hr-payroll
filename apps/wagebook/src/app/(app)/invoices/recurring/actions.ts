"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateRecurringInvoiceState = { error?: string; success?: boolean } | null;

export async function createRecurringInvoice(
  _prevState: CreateRecurringInvoiceState,
  formData: FormData,
): Promise<CreateRecurringInvoiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to set up recurring invoices." };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);
  const cadence = String(formData.get("cadence") ?? "");
  const nextInvoiceDate = String(formData.get("next_invoice_date") ?? "").trim();

  if (!customerId) {
    return { error: "Choose a customer." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  if (!["weekly", "monthly", "quarterly", "annually"].includes(cadence)) {
    return { error: "Choose how often this invoice repeats." };
  }
  if (!nextInvoiceDate) {
    return { error: "Enter the next invoice date." };
  }

  const { error } = await supabase.from("customer_invoice_templates").insert({
    org_id: membership.orgId,
    customer_id: customerId,
    description,
    amount_kobo: Number(naira(amountNaira)),
    cadence,
    next_invoice_date: nextInvoiceDate,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices/recurring");
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
    redirect("/invoices/recurring");
  }

  return supabase;
}

export async function toggleRecurringInvoice(templateId: string, active: boolean) {
  const supabase = await requireManager();
  await supabase.from("customer_invoice_templates").update({ active }).eq("id", templateId);
  revalidatePath("/invoices/recurring");
}

export async function deleteRecurringInvoice(templateId: string) {
  const supabase = await requireManager();
  await supabase.from("customer_invoice_templates").delete().eq("id", templateId);
  revalidatePath("/invoices/recurring");
}
