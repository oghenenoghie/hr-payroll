"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";

async function notifyExpenseDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  decision: "approved" | "rejected",
) {
  const { data: expense } = await supabase
    .from("expenses")
    .select("org_id, employees(user_id)")
    .eq("id", expenseId)
    .maybeSingle();

  if (!expense?.employees?.user_id) return;

  await notifyUsers(supabase, {
    orgId: expense.org_id,
    recipientUserIds: [expense.employees.user_id],
    type: decision === "approved" ? "expense_approved" : "expense_rejected",
    message:
      decision === "approved" ? "Your expense claim was approved." : "Your expense claim was rejected.",
    link: "/me",
  });
}

export async function approveExpense(expenseId: string, taxable: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // review_expense() only finalizes (and only then requires/stores
  // taxable) on the last approval step — see its own comment.
  const { data: expense } = await supabase.rpc("review_expense", {
    p_expense_id: expenseId,
    p_approve: true,
    p_taxable: taxable,
  });

  if (expense?.status === "approved") {
    await notifyExpenseDecision(supabase, expenseId, "approved");
  }

  revalidatePath("/expenses");
}

export async function rejectExpense(expenseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("review_expense", { p_expense_id: expenseId, p_approve: false });

  await notifyExpenseDecision(supabase, expenseId, "rejected");

  revalidatePath("/expenses");
}
