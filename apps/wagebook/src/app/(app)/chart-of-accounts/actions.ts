"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

const ACCOUNT_TYPES = new Set(["asset", "liability", "equity", "revenue", "expense"]);

export type CreateAccountState = { error?: string; success?: boolean } | null;

export async function createAccount(_prevState: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to manage the chart of accounts." };
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!code) {
    return { error: "Enter an account code." };
  }
  if (!name) {
    return { error: "Enter an account name." };
  }
  if (!ACCOUNT_TYPES.has(type)) {
    return { error: "Choose a valid account type." };
  }

  const { error } = await supabase
    .from("chart_of_accounts")
    .insert({ org_id: membership.orgId, code, name, type, description });

  if (error) {
    return {
      error: error.code === "23505" ? "An account with this code already exists." : error.message,
    };
  }

  revalidatePath("/chart-of-accounts");
  return { success: true };
}

export async function deleteAccount(accountId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("chart_of_accounts").delete().eq("id", accountId);

  revalidatePath("/chart-of-accounts");
}
