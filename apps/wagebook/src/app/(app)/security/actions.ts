"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type UpdateRoleState = { error?: string } | null;

const ASSIGNABLE_ROLES = new Set(["admin", "payroll_manager", "hr_manager", "employee"]);

export async function updateMemberRole(
  targetUserId: string,
  _prevState: UpdateRoleState,
  formData: FormData,
): Promise<UpdateRoleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "You don't have permission to change roles." };
  }

  const newRole = String(formData.get("role") ?? "");
  if (!ASSIGNABLE_ROLES.has(newRole)) {
    return { error: "Choose a valid role." };
  }

  const { data: target } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", membership.orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) {
    return { error: "Member not found." };
  }

  // An org must always keep at least one admin, or every "org admins can
  // ..." RLS policy in the app locks everyone out simultaneously.
  if (target.role === "admin" && newRole !== "admin") {
    const { count } = await supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.orgId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Can't change this — they're the only admin left." };
    }
  }

  const { error } = await supabase
    .from("org_memberships")
    .update({ role: newRole })
    .eq("org_id", membership.orgId)
    .eq("user_id", targetUserId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/security");
  return null;
}
