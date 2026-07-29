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

const ASSIGNABLE_ROLES = new Set(["admin", "payroll_manager", "hr_manager", "employee"]);

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

  const role = String(formData.get("role") ?? "");
  if (!ASSIGNABLE_ROLES.has(role)) {
    return { error: "Choose a valid role." };
  }

  // Staff accounts are grounded in an existing payroll record rather than a
  // freeform name/email, since /me, payslips, leave etc. all key off
  // employees.user_id — there's no such record for admin/payroll
  // manager/HR manager, so those stay freeform.
  let fullName: string;
  let email: string;
  let employeeId: string | null = null;

  if (role === "employee") {
    employeeId = String(formData.get("employee_id") ?? "").trim();
    if (!employeeId) {
      return { error: "Choose an employee." };
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, email, user_id")
      .eq("id", employeeId)
      .eq("org_id", membership.orgId)
      .maybeSingle();

    if (employeeError || !employee) {
      return { error: "Employee not found." };
    }
    if (employee.user_id) {
      return { error: "This employee already has a linked account." };
    }

    fullName = employee.full_name;
    const submittedEmail = String(formData.get("email") ?? "").trim();
    email = employee.email ?? submittedEmail;
    if (!email) {
      return { error: "Enter an email address for this employee." };
    }
    if (!employee.email) {
      const { error: emailError } = await supabase.from("employees").update({ email }).eq("id", employeeId);
      if (emailError) {
        return { error: emailError.message };
      }
    }
  } else {
    fullName = String(formData.get("full_name") ?? "").trim();
    email = String(formData.get("email") ?? "").trim();
    if (!fullName) {
      return { error: "Full name is required." };
    }
    if (!email) {
      return { error: "Email is required." };
    }
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

  if (role === "employee" && employeeId) {
    const { error: linkError } = await supabase.rpc("link_employee_account", {
      p_employee_id: employeeId,
      p_user_id: created.user.id,
    });
    if (linkError) {
      return { error: `Account created, but linking it to the employee record failed: ${linkError.message}` };
    }
  } else {
    const { error: membershipError } = await supabase
      .from("org_memberships")
      .insert({ org_id: membership.orgId, user_id: created.user.id, role });
    if (membershipError) {
      return { error: `Account created, but granting access failed: ${membershipError.message}` };
    }
  }

  return { success: true, fullName, email, password };
}
