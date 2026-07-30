"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type UpsertBudgetLineState = { error?: string } | null;

export async function upsertBudgetLine(
  _prevState: UpsertBudgetLineState,
  formData: FormData,
): Promise<UpsertBudgetLineState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to edit this budget." };
  }

  const budgetId = String(formData.get("budget_id") ?? "").trim();
  const accountCode = String(formData.get("account_code") ?? "").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);

  if (!budgetId) {
    return { error: "Missing budget." };
  }
  if (!accountCode) {
    return { error: "Choose an account." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { data: account } = await supabase
    .from("chart_of_accounts")
    .select("type")
    .eq("org_id", membership.orgId)
    .eq("code", accountCode)
    .single();
  if (!account || (account.type !== "revenue" && account.type !== "expense")) {
    return { error: "Budgets only cover revenue and expense accounts." };
  }

  const { error } = await supabase
    .from("budget_lines")
    .upsert(
      { budget_id: budgetId, account_code: accountCode, amount_kobo: Number(naira(amountNaira)) },
      { onConflict: "budget_id,account_code" },
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/budgets/${budgetId}`);
  return null;
}

export async function deleteBudgetLine(lineId: string, budgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("budget_lines").delete().eq("id", lineId);
  revalidatePath(`/budgets/${budgetId}`);
}

export async function deleteBudget(budgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("budgets").delete().eq("id", budgetId);
  redirect("/budgets");
}
