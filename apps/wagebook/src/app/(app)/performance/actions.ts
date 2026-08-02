"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";

export type FormState = { error?: string; success?: boolean } | null;

async function requireEmployee(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("employees").select("id, org_id").eq("user_id", userId).maybeSingle();
  return data;
}

export async function createOwnGoal(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employee = await requireEmployee(supabase, user.id);
  if (!employee) return { error: "Your account isn't linked to an employee record." };

  return createGoal(supabase, employee.id, formData);
}

export async function createGoalForEmployee(
  employeeId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return createGoal(supabase, employeeId, formData);
}

async function createGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  formData: FormData,
): Promise<FormState> {
  const cycleId = String(formData.get("cycle_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "");

  if (!cycleId) return { error: "Pick a review cycle." };
  if (!title) return { error: "Enter a goal title." };

  const { data: employee } = await supabase.from("employees").select("org_id").eq("id", employeeId).maybeSingle();
  if (!employee) return { error: "Employee not found." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("performance_goals").insert({
    org_id: employee.org_id,
    employee_id: employeeId,
    cycle_id: cycleId,
    title,
    description: description || null,
    target_date: targetDate || null,
    created_by: user!.id,
  });

  if (error) return { error: error.message };

  const { data: linkedEmployee } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (linkedEmployee?.user_id && linkedEmployee.user_id !== user!.id) {
    await notifyUsers(supabase, {
      orgId: employee.org_id,
      recipientUserIds: [linkedEmployee.user_id],
      type: "performance_goal_assigned",
      message: `A new performance goal was set for you: "${title}".`,
      link: "/me",
    });
  }

  revalidatePath("/me");
  revalidatePath("/team");
  revalidatePath("/performance");
  return { success: true };
}

export async function updateGoalStatus(goalId: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("performance_goals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", goalId);

  revalidatePath("/me");
  revalidatePath("/team");
  revalidatePath("/performance");
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("performance_goals").delete().eq("id", goalId);

  revalidatePath("/me");
  revalidatePath("/team");
  revalidatePath("/performance");
}

export async function startAppraisal(employeeId: string, cycleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase.from("employees").select("org_id").eq("id", employeeId).maybeSingle();
  if (!employee) return;

  await supabase.from("performance_appraisals").insert({
    org_id: employee.org_id,
    employee_id: employeeId,
    cycle_id: cycleId,
  });

  revalidatePath("/team");
  revalidatePath("/performance");
}

export async function submitAppraisal(appraisalId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rating = Number(formData.get("rating") ?? 0);
  const strengths = String(formData.get("strengths") ?? "").trim();
  const areasForImprovement = String(formData.get("areas_for_improvement") ?? "").trim();
  const managerComments = String(formData.get("manager_comments") ?? "").trim();

  if (!rating || rating < 1 || rating > 5) return { error: "Pick a rating from 1 to 5." };

  const { data: updated, error } = await supabase
    .from("performance_appraisals")
    .update({
      rating,
      strengths: strengths || null,
      areas_for_improvement: areasForImprovement || null,
      manager_comments: managerComments || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", appraisalId)
    .select("org_id, employees(user_id)")
    .maybeSingle();

  if (error) return { error: error.message };

  if (updated?.employees?.user_id) {
    await notifyUsers(supabase, {
      orgId: updated.org_id,
      recipientUserIds: [updated.employees.user_id],
      type: "performance_appraisal_submitted",
      message: "Your performance appraisal is ready for you to review and acknowledge.",
      link: "/me",
    });
  }

  revalidatePath("/team");
  revalidatePath("/performance");
  revalidatePath("/me");
  return { success: true };
}

export async function acknowledgeAppraisal(
  appraisalId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employeeComments = String(formData.get("employee_comments") ?? "").trim();

  const { data: acknowledged, error } = await supabase.rpc("acknowledge_performance_appraisal", {
    p_appraisal_id: appraisalId,
    p_employee_comments: employeeComments || undefined,
  });

  if (error) return { error: error.message };

  if (acknowledged?.reviewed_by) {
    await notifyUsers(supabase, {
      orgId: acknowledged.org_id,
      recipientUserIds: [acknowledged.reviewed_by],
      type: "performance_appraisal_acknowledged",
      message: "An employee acknowledged their performance appraisal.",
      link: "/team",
    });
  }

  revalidatePath("/me");
  revalidatePath("/team");
  revalidatePath("/performance");
  return { success: true };
}
