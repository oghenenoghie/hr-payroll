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
  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "finance_manager")
  ) {
    return { error: "You don't have permission to edit this budget." };
  }

  const budgetId = String(formData.get("budget_id") ?? "").trim();
  const accountCode = String(formData.get("account_code") ?? "").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);
  const periodStart = String(formData.get("period_start") ?? "").trim();
  const periodEnd = String(formData.get("period_end") ?? "").trim();

  if (!budgetId) {
    return { error: "Missing budget." };
  }
  if (!accountCode) {
    return { error: "Choose an account." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  if (!periodStart || !periodEnd) {
    return { error: "Enter both a period start and end date for this line." };
  }
  if (periodEnd < periodStart) {
    return { error: "The line's end date can't be before its start date." };
  }

  const { data: budget } = await supabase
    .from("budgets")
    .select("org_id, budget_type, period_start, period_end")
    .eq("id", budgetId)
    .single();
  if (!budget) {
    return { error: "Budget not found." };
  }
  if (periodStart < budget.period_start || periodEnd > budget.period_end) {
    return { error: "The line's period must fall within the budget's own period." };
  }

  const { data: account } = await supabase
    .from("chart_of_accounts")
    .select("type")
    .eq("org_id", budget.org_id)
    .eq("code", accountCode)
    .single();

  // Which account types are valid depends on the budget's own type — an
  // operating budget still only covers revenue/expense exactly as before;
  // a capital budget covers planned asset spend; a cash budget covers
  // planned obligations (liability accounts) plus the cash account
  // itself. Matches the account_code type check this action already had,
  // just branched on budget_type.
  const validForType =
    budget.budget_type === "operating"
      ? account?.type === "revenue" || account?.type === "expense"
      : budget.budget_type === "capital"
        ? account?.type === "asset"
        : account?.type === "liability" || accountCode === "cash_and_bank";
  if (!account || !validForType) {
    const allowed =
      budget.budget_type === "operating"
        ? "revenue and expense"
        : budget.budget_type === "capital"
          ? "asset"
          : "liability and cash";
    return { error: `This budget only covers ${allowed} accounts.` };
  }

  const { error } = await supabase
    .from("budget_lines")
    .upsert(
      {
        budget_id: budgetId,
        account_code: accountCode,
        period_start: periodStart,
        period_end: periodEnd,
        amount_kobo: Number(naira(amountNaira)),
      },
      { onConflict: "budget_id,account_code,period_start,period_end" },
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
