"use server";

import { redirect } from "next/navigation";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateReconciliationState = { error?: string } | null;

export async function createReconciliation(
  _prevState: CreateReconciliationState,
  formData: FormData,
): Promise<CreateReconciliationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to start a reconciliation." };
  }

  const periodEnd = String(formData.get("period_end") ?? "").trim();
  const statementBalanceNaira = Number(formData.get("statement_balance") ?? NaN);

  if (!periodEnd) {
    return { error: "Enter the statement period end date." };
  }
  if (Number.isNaN(statementBalanceNaira)) {
    return { error: "Enter the statement's ending balance." };
  }

  const { data: reconciliation, error } = await supabase
    .from("bank_reconciliations")
    .insert({
      org_id: membership.orgId,
      period_end: periodEnd,
      statement_balance_kobo: Number(naira(statementBalanceNaira)),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !reconciliation) {
    return { error: error?.message ?? "Could not start the reconciliation." };
  }

  redirect(`/bank-reconciliation/${reconciliation.id}`);
}
