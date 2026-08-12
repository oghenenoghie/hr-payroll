"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1, computeVat, naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { parseLineItemsField } from "@/lib/lineItems";

export type CreateInvoiceState = { error?: string; success?: boolean } | null;

export async function createCustomerInvoice(
  _prevState: CreateInvoiceState,
  formData: FormData,
): Promise<CreateInvoiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to raise customer invoices." };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const invoiceDate = String(formData.get("invoice_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const vatCategory = String(formData.get("vat_category") ?? "standard").trim() || "standard";
  const lines = parseLineItemsField(formData.get("lines"));

  if (!customerId) {
    return { error: "Choose a customer." };
  }
  if (!invoiceDate) {
    return { error: "Enter an invoice date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (lines.length === 0) {
    return { error: "Add at least one line item." };
  }

  const subtotalKobo = lines.reduce((sum, line) => sum + line.line_total_kobo, 0);
  if (subtotalKobo <= 0) {
    return { error: "Line items must total more than zero." };
  }

  const ruleVersion = NG_2026_1;
  const { vatKobo, exempt: vatExempt } = computeVat(BigInt(subtotalKobo), vatCategory, ruleVersion);

  const { error } = await supabase.rpc("create_customer_invoice_with_lines", {
    p_customer_id: customerId,
    p_description: description,
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_subtotal_kobo: subtotalKobo,
    p_vat_category: vatCategory,
    p_vat_kobo: Number(vatKobo),
    p_vat_exempt: vatExempt,
    p_rule_version_id: ruleVersion.id,
    p_lines: lines,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices");
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
    redirect("/invoices");
  }

  return supabase;
}

export async function issueCustomerInvoice(invoiceId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("issue_customer_invoice", { p_invoice_id: invoiceId });
  revalidatePath("/invoices");
}

export async function voidCustomerInvoice(invoiceId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("void_customer_invoice", { p_invoice_id: invoiceId });
  revalidatePath("/invoices");
}

export type ReceivePaymentState = { error?: string } | null;

export async function receiveCustomerPayment(
  invoiceId: string,
  _prevState: ReceivePaymentState,
  formData: FormData,
): Promise<ReceivePaymentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to record payments." };
  }

  const amountNaira = Number(formData.get("amount") ?? 0);
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { error } = await supabase.rpc("receive_customer_payment", {
    p_invoice_id: invoiceId,
    p_amount_kobo: Number(naira(amountNaira)),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices");
  return null;
}

export type IssueCreditNoteState = { error?: string } | null;

export async function issueCreditNote(
  invoiceId: string,
  _prevState: IssueCreditNoteState,
  formData: FormData,
): Promise<IssueCreditNoteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to issue credit notes." };
  }

  const amountNaira = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  if (!reason) {
    return { error: "Enter a reason for the credit note." };
  }

  const { error } = await supabase.rpc("issue_credit_note", {
    p_invoice_id: invoiceId,
    p_amount_kobo: Number(naira(amountNaira)),
    p_reason: reason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices");
  return null;
}
