"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
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
  updateTag("chart_of_accounts");
  return { success: true };
}

export type UpdateAccountState = { error?: string; success?: boolean } | null;

export async function updateAccount(
  accountId: string,
  _prevState: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
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

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) {
    return { error: "Enter an account name." };
  }
  if (!ACCOUNT_TYPES.has(type)) {
    return { error: "Choose a valid account type." };
  }

  // A system account's code stays locked (also enforced in the database by
  // a trigger — see 20260817020000_chart_of_accounts_edit_guard.sql — this
  // is just what keeps the code input off a system account's edit form in
  // the first place). A custom account's code field is present and
  // required, normalized the same way createAccount above does.
  const updates: { name: string; type: string; description: string | null; code?: string } = {
    name,
    type,
    description,
  };

  const codeRaw = formData.get("code");
  if (codeRaw !== null) {
    const code = String(codeRaw).trim().toLowerCase().replace(/\s+/g, "_");
    if (!code) {
      return { error: "Enter an account code." };
    }
    updates.code = code;
  }

  const { error } = await supabase.from("chart_of_accounts").update(updates).eq("id", accountId);

  if (error) {
    return {
      error: error.code === "23505" ? "An account with this code already exists." : error.message,
    };
  }

  revalidatePath("/chart-of-accounts");
  updateTag("chart_of_accounts");
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
  updateTag("chart_of_accounts");
}
