"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateBranchState = { error?: string; success?: boolean } | null;

export async function createBranch(_prevState: CreateBranchState, formData: FormData): Promise<CreateBranchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to manage branches." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) {
    return { error: "Enter a branch name." };
  }

  const { error } = await supabase.from("branches").insert({ org_id: membership.orgId, name, state, address });

  if (error) {
    return {
      error: error.code === "23505" ? "A branch with this name already exists." : error.message,
    };
  }

  revalidatePath("/branches");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return { success: true };
}

export async function deleteBranch(branchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("branches").delete().eq("id", branchId);

  revalidatePath("/branches");
  revalidatePath("/employees");
}
