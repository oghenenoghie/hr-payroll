"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveExpense(expenseId: string, taxable: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("expenses")
    .update({ status: "approved", taxable, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", expenseId);

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

  await supabase
    .from("expenses")
    .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", expenseId);

  revalidatePath("/expenses");
}
