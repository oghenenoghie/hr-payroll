"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import type { Json } from "@plutus/core";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateInvoiceState = { error?: string; success?: boolean; invoiceNumber?: string } | null;

type DraftLine = { description?: unknown; quantity?: unknown; unit_price_kobo?: unknown; discount_kobo?: unknown };

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

  if (!customerId) {
    return { error: "Choose a customer." };
  }
  if (!invoiceDate) {
    return { error: "Enter an invoice date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }

  // The line-item editor serializes its rows as JSON into this hidden
  // field — real validation and every total (subtotal/VAT/amount) happen
  // server-side in create_customer_invoice_with_lines, which never trusts
  // a client-submitted total; this is just enough of a client-side shape
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

  const { data, error } = await supabase.rpc("create_customer_invoice_with_lines", {
    p_org_id: membership.orgId,
    p_customer_id: customerId,
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_description: description,
    p_lines: lines as unknown as Json,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices");
  revalidatePath("/customers");
  return { success: true, invoiceNumber: data?.invoice_number };
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
