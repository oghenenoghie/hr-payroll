"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";

export type UpdateRoleState = { error?: string } | null;

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
  if (!newRole) {
    return { error: "Choose a role." };
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
    // 23503: foreign key violation — newRole isn't a key in `roles`, the
    // database's own guarantee now that org_memberships.role -> roles.key.
    return { error: error.code === "23503" ? "Choose a valid role." : error.message };
  }

  revalidatePath("/security");
  return null;
}

// Deliberately excludes 'employee' (that self-service invite is tied to a
// specific employees record and goes through employees/[id]/edit/actions.ts's
// inviteEmployeeAccount, which links the two atomically) and
// 'department_manager' (that role is granted from the department it heads,
// via departments/actions.ts's setDepartmentManager, since it only makes
// sense attached to an existing employee record and a department).
const INVITABLE_ROLES = new Set(["admin", "payroll_manager", "hr_manager", "accountant", "auditor"]);

export type InviteTeamMemberState = { error?: string; success?: boolean } | null;

// Only Admin can grant operational roles — mirrors org_memberships' own
// RLS (only admin can INSERT/UPDATE a membership row for any role other
// than HR onboarding a plain 'employee'), so this action can't do
// anything the caller's own session doesn't already have the standing
// database privilege for.
export async function inviteTeamMember(
  _prevState: InviteTeamMemberState,
  formData: FormData,
): Promise<InviteTeamMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return { error: "Only Super Admin can invite team members." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!email) {
    return { error: "Enter an email address to invite." };
  }
  if (!INVITABLE_ROLES.has(role)) {
    return { error: "Choose a valid role." };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Failed to send invite." };
  }

  const { error: membershipError } = await supabase
    .from("org_memberships")
    .insert({ org_id: membership.orgId, user_id: invited.user.id, role });

  if (membershipError) {
    return { error: `Invite sent, but granting access failed: ${membershipError.message}` };
  }

  revalidatePath("/security");
  return { success: true };
}
