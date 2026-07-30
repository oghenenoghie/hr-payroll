"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateDepartmentState = { error?: string; success?: boolean } | null;

export async function createDepartment(
  _prevState: CreateDepartmentState,
  formData: FormData,
): Promise<CreateDepartmentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to manage departments." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a department name." };
  }

  const { error } = await supabase.from("departments").insert({ org_id: membership.orgId, name });

  if (error) {
    return {
      error: error.code === "23505" ? "A department with this name already exists." : error.message,
    };
  }

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return { success: true };
}

export type SetDepartmentManagerState = { error?: string } | null;

// Admin-only, deliberately not extended to HR — this changes an org
// member's *role* (granting department_manager), and org_memberships'
// own RLS reserves role changes to admin (HR can only ever insert a
// fresh 'employee'-role row, never touch an existing membership). See
// org_tenant_foundation.sql's "org admins can update memberships" policy.
export async function setDepartmentManager(
  departmentId: string,
  _prevState: SetDepartmentManagerState,
  formData: FormData,
): Promise<SetDepartmentManagerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return { error: "Only Super Admin can assign a department manager." };
  }

  const employeeId = String(formData.get("employee_id") ?? "").trim() || null;

  const { error: departmentError } = await supabase
    .from("departments")
    .update({ manager_id: employeeId })
    .eq("id", departmentId);

  if (departmentError) {
    return { error: departmentError.message };
  }

  if (employeeId) {
    const { data: employee } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", employeeId)
      .maybeSingle();

    // Only grants the role for an employee who already has a linked
    // self-service account (nothing to attach an org_membership row to
    // otherwise) and only when it's a safe upgrade — never silently
    // downgrades someone who already holds a different, broader role
    // (e.g. an admin assigned to head a department stays admin).
    if (employee?.user_id) {
      const { data: existing } = await supabase
        .from("org_memberships")
        .select("role")
        .eq("org_id", membership.orgId)
        .eq("user_id", employee.user_id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from("org_memberships")
          .insert({ org_id: membership.orgId, user_id: employee.user_id, role: "department_manager" });
      } else if (existing.role === "employee") {
        await supabase
          .from("org_memberships")
          .update({ role: "department_manager" })
          .eq("org_id", membership.orgId)
          .eq("user_id", employee.user_id);
      }
    }
  }

  revalidatePath("/departments");
  return null;
}

export async function deleteDepartment(departmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("departments").delete().eq("id", departmentId);

  revalidatePath("/departments");
  revalidatePath("/employees");
}
