"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";

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
