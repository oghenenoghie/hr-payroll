"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";

export type CreateTeamMemberState =
  | { error: string }
  | { success: true; fullName: string; email: string; password: string }
  | null;

const ASSIGNABLE_ROLES = new Set(["admin", "payroll_manager", "hr_manager"]);

// Generated fresh per account — never derived from anything guessable
// (email, name, timestamp) — and shown to the admin exactly once, since
// this flow's whole point is the admin hand-delivers it out of band
// instead of the user setting their own via an emailed link.
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function createTeamMember(
  _prevState: CreateTeamMemberState,
  formData: FormData,
): Promise<CreateTeamMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "You don't have permission to add team members." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!fullName) {
    return { error: "Full name is required." };
  }
  if (!email) {
    return { error: "Email is required." };
  }
  if (!ASSIGNABLE_ROLES.has(role)) {
    return { error: "Choose a valid role." };
  }

  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Failed to create the account." };
  }

  const { error: membershipError } = await supabase
    .from("org_memberships")
    .insert({ org_id: membership.orgId, user_id: created.user.id, role });

  if (membershipError) {
    return { error: `Account created, but granting access failed: ${membershipError.message}` };
  }

  return { success: true, fullName, email, password };
}
