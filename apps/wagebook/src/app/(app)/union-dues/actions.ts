"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { notifyUsers } from "@/lib/notifications";

const MANAGE_ROLES = ["admin", "hr_manager", "payroll_manager", "accountant"];

export type CreateUnionDuesPlanState = { error?: string; success?: boolean } | null;

export async function createUnionDuesPlan(
  _prevState: CreateUnionDuesPlanState,
  formData: FormData,
): Promise<CreateUnionDuesPlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to manage union dues plans." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);

  if (!name) {
    return { error: "Enter the union's name." };
  }
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return { error: "Enter a due amount greater than zero." };
  }

  const { error } = await supabase.from("union_dues_plans").insert({
    org_id: membership.orgId,
    name,
    amount_kobo: Number(naira(amountNaira)),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/union-dues");
  return { success: true };
}

export async function setUnionDuesPlanActive(planId: string, active: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("union_dues_plans").update({ active }).eq("id", planId);

  revalidatePath("/union-dues");
}

export type EnrollEmployeeState = { error?: string; success?: boolean } | null;

export async function enrollEmployee(
  _prevState: EnrollEmployeeState,
  formData: FormData,
): Promise<EnrollEmployeeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to enroll employees." };
  }

  const employeeId = String(formData.get("employee_id") ?? "");
  const unionDuesPlanId = String(formData.get("union_dues_plan_id") ?? "");

  if (!employeeId || !unionDuesPlanId) {
    return { error: "Choose an employee and a union." };
  }

  const { error } = await supabase.from("employee_union_due_enrollments").insert({
    org_id: membership.orgId,
    employee_id: employeeId,
    union_dues_plan_id: unionDuesPlanId,
    enrolled_by: user.id,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "This employee is already enrolled with that union." : error.message,
    };
  }

  const [{ data: employee }, { data: plan }] = await Promise.all([
    supabase.from("employees").select("user_id").eq("id", employeeId).maybeSingle(),
    supabase.from("union_dues_plans").select("name").eq("id", unionDuesPlanId).maybeSingle(),
  ]);

  if (employee?.user_id) {
    await notifyUsers(supabase, {
      orgId: membership.orgId,
      recipientUserIds: [employee.user_id],
      type: "union_dues_enrolled",
      message: `You've been enrolled for ${plan?.name ?? "trade union"} dues.`,
      link: "/me",
    });
  }

  revalidatePath("/union-dues");
  return { success: true };
}

export async function cancelEnrollment(enrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("employee_union_due_enrollments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  revalidatePath("/union-dues");
}
