"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateBudgetState = { error?: string } | null;

export async function createBudget(_prevState: CreateBudgetState, formData: FormData): Promise<CreateBudgetState> {
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
    return { error: "You don't have permission to create a budget." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "").trim();
  const periodEnd = String(formData.get("period_end") ?? "").trim();
  const budgetType = String(formData.get("budget_type") ?? "operating").trim();

  if (!name) {
    return { error: "Enter a budget name." };
  }
  if (!periodStart || !periodEnd) {
    return { error: "Enter both a start and end date." };
  }
  if (periodEnd < periodStart) {
    return { error: "The end date can't be before the start date." };
  }
  if (budgetType !== "operating" && budgetType !== "capital" && budgetType !== "cash") {
    return { error: "Invalid budget type." };
  }

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({
      org_id: membership.orgId,
      name,
      period_start: periodStart,
      period_end: periodEnd,
      budget_type: budgetType,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !budget) {
    return { error: error?.message ?? "Could not create the budget." };
  }

  redirect(`/budgets/${budget.id}`);
}
