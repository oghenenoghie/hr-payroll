"use server";

import { randomBytes } from "node:crypto";
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

// Deliberately excludes 'employee' (that self-service account is tied to a
// specific employees record and goes through employees/[id]/edit/actions.ts's
// inviteEmployeeAccount, which links the two atomically) and
// 'department_manager' (that role is granted from the department it heads,
// via departments/actions.ts's setDepartmentManager, since it only makes
// sense attached to an existing employee record and a department).
const CREATABLE_ROLES = new Set(["admin", "payroll_manager", "hr_manager", "accountant", "auditor"]);

// Generated fresh per account, shown to the admin exactly once — same
// approach as security/new/actions.ts's createTeamMember, and for the
// same reason: this used to go through admin.auth.admin.inviteUserByEmail(),
// which mails a magic link the person must click before they have any
// password at all. Without custom SMTP configured on the Supabase
// project that mail is unreliable (Supabase's built-in mailer is
// heavily rate-limited) or silently undelivered, and the account sat
// there with no way in — indistinguishable from a wrong password at the
// login screen. Creating the account with a real password up front
// means access never depends on an email arriving.
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export type AddTeamMemberState =
  | { error: string }
  | { success: true; email: string; password: string }
  | null;

// Only Admin can grant operational roles — mirrors org_memberships' own
// RLS (only admin can INSERT/UPDATE a membership row for any role other
// than HR onboarding a plain 'employee'), so this action can't do
// anything the caller's own session doesn't already have the standing
// database privilege for.
export async function addTeamMember(
  _prevState: AddTeamMemberState,
  formData: FormData,
): Promise<AddTeamMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return { error: "Only Super Admin can add team members." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!email) {
    return { error: "Enter an email address." };
  }
  if (!CREATABLE_ROLES.has(role)) {
    return { error: "Choose a valid role." };
  }

  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Failed to create the account." };
  }

  const { error: membershipError } = await supabase
    .from("org_memberships")
    .insert({ org_id: membership.orgId, user_id: created.user.id, role });

  if (membershipError) {
    // Roll back the auth user rather than leaving it orphaned — otherwise
    // every retry hits "email already registered" with no membership row
    // to show for it, the same reasoning as createTeamMember's rollback.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Couldn't grant access: ${membershipError.message}` };
  }

  revalidatePath("/security");
  return { success: true, email, password };
}
