"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type AddStatementLineState = { error?: string } | null;

export async function addStatementLine(
  _prevState: AddStatementLineState,
  formData: FormData,
): Promise<AddStatementLineState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to add statement lines." };
  }

  const reconciliationId = String(formData.get("reconciliation_id") ?? "").trim();
  const lineDate = String(formData.get("line_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const amountNaira = Number(formData.get("amount") ?? 0);

  if (!reconciliationId) {
    return { error: "Missing reconciliation." };
  }
  if (!lineDate) {
    return { error: "Enter a date." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }
  if (type !== "deposit" && type !== "withdrawal") {
    return { error: "Choose deposit or withdrawal." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { data: reconciliation } = await supabase
    .from("bank_reconciliations")
    .select("status")
    .eq("id", reconciliationId)
    .single();
  if (!reconciliation || reconciliation.status !== "in_progress") {
    return { error: "This reconciliation is no longer in progress." };
  }

  const { error } = await supabase.from("bank_statement_lines").insert({
    org_id: membership.orgId,
    reconciliation_id: reconciliationId,
    line_date: lineDate,
    description,
    amount_kobo: Number(naira(amountNaira)),
    type,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
  return null;
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
    redirect("/bank-reconciliation");
  }

  return supabase;
}

export async function matchStatementLine(formData: FormData) {
  const supabase = await requireApprover();

  const lineId = String(formData.get("line_id") ?? "").trim();
  const postingId = String(formData.get("posting_id") ?? "").trim();
  const reconciliationId = String(formData.get("reconciliation_id") ?? "").trim();

  if (lineId && postingId) {
    await supabase.rpc("match_bank_statement_line", { p_line_id: lineId, p_posting_id: postingId });
  }

  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
}

export async function unmatchStatementLine(lineId: string, reconciliationId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("unmatch_bank_statement_line", { p_line_id: lineId });
  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
}

export async function completeReconciliation(reconciliationId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("complete_bank_reconciliation", { p_reconciliation_id: reconciliationId });
  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
  revalidatePath("/bank-reconciliation");
}

export async function reopenReconciliation(reconciliationId: string) {
  const supabase = await requireApprover();
  await supabase.rpc("reopen_bank_reconciliation", { p_reconciliation_id: reconciliationId });
  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
  revalidatePath("/bank-reconciliation");
}

export async function postBankStatementItem(formData: FormData) {
  const supabase = await requireApprover();

  const lineId = String(formData.get("line_id") ?? "").trim();
  const accountCode = String(formData.get("account_code") ?? "").trim();
  const reconciliationId = String(formData.get("reconciliation_id") ?? "").trim();

  if (lineId && accountCode) {
    await supabase.rpc("post_bank_statement_item", { p_line_id: lineId, p_account_code: accountCode });
  }

  revalidatePath(`/bank-reconciliation/${reconciliationId}`);
}
