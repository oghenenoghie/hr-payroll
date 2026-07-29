"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";

export type CreateTeamMemberState =
  | { error: string }
  | { success: true; fullName: string; loginIdentifier: string; password: string }
  | null;

// Generated fresh per account — never derived from anything guessable
// (email, name, timestamp) — and shown to the admin exactly once, since
// this flow's whole point is the admin hand-delivers it out of band
// instead of the user setting their own via an emailed link.
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

// Supabase Auth is keyed on email internally even for an Employee-ID-only
// account — this is never shown anywhere and never sent mail. `.internal`
// is reserved by RFC 8375 for exactly this: non-routable, guaranteed not
// to collide with a real domain someone might register.
function syntheticAuthEmail(): string {
  return `${randomUUID()}@employee-login.internal`;
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
  const { data: roleRow } = await supabase.from("roles").select("key").eq("key", role).maybeSingle();
  if (!roleRow) {
    return { error: "Choose a valid role." };
  }

  // Staff accounts are grounded in an existing payroll record rather than a
  // freeform name/email, since /me, payslips, leave etc. all key off
  // employees.user_id — there's no such record for admin/payroll
  // manager/HR manager, so those stay freeform.
  let fullName: string;
  let authEmail: string;
  // What the admin hands the person to type into the login field — a real
  // email, or an Employee ID when there's no email at all. Never the
  // synthetic auth email, which is purely an internal Supabase Auth key.
  let loginIdentifier: string;
  let employeeId: string | null = null;

  if (role === "employee") {
    employeeId = String(formData.get("employee_id") ?? "").trim();
    if (!employeeId) {
      return { error: "Choose an employee." };
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, email, employee_id, user_id")
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
    const email = employee.email ?? (submittedEmail || null);
    const submittedStaffId = String(formData.get("staff_employee_id") ?? "").trim();
    const staffId = employee.employee_id ?? (submittedStaffId || null);

    if (!email && !staffId) {
      return { error: "Enter an email or an Employee ID for this employee." };
    }

    const employeeUpdate: { email?: string; employee_id?: string } = {};
    if (email && !employee.email) employeeUpdate.email = email;
    if (staffId && !employee.employee_id) employeeUpdate.employee_id = staffId;
    if (Object.keys(employeeUpdate).length > 0) {
      const { error: updateError } = await supabase.from("employees").update(employeeUpdate).eq("id", employeeId);
      if (updateError) {
        return {
          error: updateError.code === "23505" ? "That Employee ID is already in use." : updateError.message,
        };
      }
    }

    authEmail = email ?? syntheticAuthEmail();
    loginIdentifier = email ?? staffId!;
  } else {
    fullName = String(formData.get("full_name") ?? "").trim();
    authEmail = String(formData.get("email") ?? "").trim();
    loginIdentifier = authEmail;
    if (!fullName) {
      return { error: "Full name is required." };
    }
    if (!authEmail) {
      return { error: "Email is required." };
    }
  }

  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
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
      // Roll back the auth user rather than leaving it orphaned — otherwise
      // every retry hits "email already registered" at createUser above,
      // with the employee record still showing as unlinked and no way to
      // fix it short of deleting the stray account by hand in Supabase.
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: `Couldn't link this account to the employee record: ${linkError.message}` };
    }
  } else {
    const { error: membershipError } = await supabase
      .from("org_memberships")
      .insert({ org_id: membership.orgId, user_id: created.user.id, role });
    if (membershipError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: `Couldn't grant access: ${membershipError.message}` };
    }
  }

  return { success: true, fullName, loginIdentifier, password };
}
