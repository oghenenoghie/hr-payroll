"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1, UnknownWhtCategoryError, computeVendorInvoiceTotals } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { parseLineItemsField } from "@/lib/lineItems";

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
  const billDate = String(formData.get("bill_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const vatCategory = String(formData.get("vat_category") ?? "standard").trim() || "standard";
  const whtCategory = String(formData.get("wht_category") ?? "").trim();
  const lines = parseLineItemsField(formData.get("lines"));

  if (!vendorId) {
    return { error: "Choose a vendor." };
  }
  if (!billDate) {
    return { error: "Enter a bill date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (lines.length === 0) {
    return { error: "Add at least one line item." };
  }
  if (!whtCategory) {
    return { error: "Select a WHT category." };
  }

  const subtotalKobo = lines.reduce((sum, line) => sum + line.line_total_kobo, 0);
  if (subtotalKobo <= 0) {
    return { error: "Line items must total more than zero." };
  }

  const ruleVersion = NG_2026_1;
  let totals;
  try {
    totals = computeVendorInvoiceTotals({ subtotalKobo: BigInt(subtotalKobo), vatCategory, whtCategory }, ruleVersion);
  } catch (err) {
    if (err instanceof UnknownWhtCategoryError) {
      return { error: "Unrecognized WHT category." };
    }
    throw err;
  }

  const { error } = await supabase.rpc("create_vendor_bill_with_lines", {
    p_vendor_id: vendorId,
    p_description: description,
    p_bill_date: billDate,
    p_due_date: dueDate,
    p_subtotal_kobo: Number(totals.subtotalKobo),
    p_vat_category: vatCategory,
    p_vat_kobo: Number(totals.vatKobo),
    p_vat_exempt: totals.vatExempt,
    p_wht_category: whtCategory,
    p_wht_kobo: Number(totals.whtKobo),
    p_rule_version_id: ruleVersion.id,
    p_lines: lines,
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

export type BillActionResult = { error?: string } | null;

// Now that approval routes through the configurable step engine
// (20260815010000_bill_approval_engine.sql), a permission error here is
// an ordinary, expected outcome — not just a bug case — the moment an org
// configures more than one step: a step-1 approver clicking Approve on a
// bill still waiting on step 2's specific role gets this exact error.
// Silently ignoring supabase.rpc()'s error field (as this used to) would
// leave that reviewer with no idea anything happened.
export async function approveVendorBill(billId: string): Promise<BillActionResult> {
  const supabase = await requireApprover();
  const { error } = await supabase.rpc("approve_vendor_bill", { p_bill_id: billId });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/bills");
  return null;
}

export async function rejectVendorBill(billId: string): Promise<BillActionResult> {
  const supabase = await requireApprover();
  const { error } = await supabase.rpc("reject_vendor_bill", { p_bill_id: billId });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/bills");
  return null;
}

export async function payVendorBill(billId: string): Promise<BillActionResult> {
  const supabase = await requireApprover();
  const { error } = await supabase.rpc("pay_vendor_bill", { p_bill_id: billId });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/bills");
  return null;
}

export type ScheduleBillPaymentState = { error?: string } | null;

export async function scheduleVendorBillPayment(
  billId: string,
  _prevState: ScheduleBillPaymentState,
  formData: FormData,
): Promise<ScheduleBillPaymentState> {
  const supabase = await requireApprover();
  const paymentDate = String(formData.get("payment_date") ?? "").trim();
  if (!paymentDate) {
    return { error: "Choose a payment date." };
  }

  const { error } = await supabase.rpc("schedule_vendor_bill_payment", {
    p_bill_id: billId,
    p_payment_date: paymentDate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bills");
  return null;
}

export type CancelBillState = { error?: string } | null;

export async function cancelVendorBill(
  billId: string,
  _prevState: CancelBillState,
  formData: FormData,
): Promise<CancelBillState> {
  const supabase = await requireApprover();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { error: "A reason is required to cancel a bill." };
  }

  const { error } = await supabase.rpc("cancel_vendor_bill", { p_bill_id: billId, p_reason: reason });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bills");
  return null;
}

export async function payVendorBillsBatch(billIds: string[]): Promise<BillActionResult> {
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
    return null;
  }

  const { error } = await supabase.rpc("pay_vendor_bills_batch", { p_org_id: membership.orgId, p_bill_ids: billIds });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/bills");
  return null;
}

// Unlike pay_vendor_bills_batch, approving/rejecting has no aggregate-
// journal-entry benefit to batch for — each bill's approval already posts
// its own distinct expense/AP entry, and there's nothing analogous to
// batch's single netted cash credit. So a "batch" here is just calling the
// existing single-bill RPC per id; each call is still its own atomic,
// RLS-checked transaction, so one bad row can't roll back the rest. Errors
// are collected rather than thrown, since a mixed batch (e.g. some bills
// at a step this reviewer can act on, others not) should still apply to
// every bill it can and report the rest by exception, not abort the whole
// batch on the first failure.
export type BillBatchResult = { succeededCount: number; errors: string[] };

export async function approveVendorBillsBatch(billIds: string[]): Promise<BillBatchResult> {
  const supabase = await requireApprover();
  let succeededCount = 0;
  const errors: string[] = [];
  for (const billId of billIds) {
    const { error } = await supabase.rpc("approve_vendor_bill", { p_bill_id: billId });
    if (error) {
      errors.push(error.message);
    } else {
      succeededCount++;
    }
  }
  revalidatePath("/bills");
  return { succeededCount, errors };
}

export async function rejectVendorBillsBatch(billIds: string[]): Promise<BillBatchResult> {
  const supabase = await requireApprover();
  let succeededCount = 0;
  const errors: string[] = [];
  for (const billId of billIds) {
    const { error } = await supabase.rpc("reject_vendor_bill", { p_bill_id: billId });
    if (error) {
      errors.push(error.message);
    } else {
      succeededCount++;
    }
  }
  revalidatePath("/bills");
  return { succeededCount, errors };
}
