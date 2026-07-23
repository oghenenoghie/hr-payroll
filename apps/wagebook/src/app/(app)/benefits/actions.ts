"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateBenefitPlanState = { error?: string; success?: boolean } | null;

export async function createBenefitPlan(
  _prevState: CreateBenefitPlanState,
  formData: FormData,
): Promise<CreateBenefitPlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to manage benefit plans." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const employerCostNaira = Number(formData.get("employer_cost") ?? 0);
  const employeeCostNaira = Number(formData.get("employee_cost") ?? 0);

  if (!name) {
    return { error: "Enter a plan name." };
  }
  if (employerCostNaira < 0 || employeeCostNaira < 0) {
    return { error: "Costs can't be negative." };
  }

  const { error } = await supabase.from("benefit_plans").insert({
    org_id: membership.orgId,
    name,
    category,
    employer_cost_kobo: Number(naira(employerCostNaira)),
    employee_cost_kobo: Number(naira(employeeCostNaira)),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/benefits");
  return { success: true };
}

export async function setBenefitPlanActive(planId: string, active: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("benefit_plans").update({ active }).eq("id", planId);

  revalidatePath("/benefits");
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
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to enroll employees." };
  }

  const employeeId = String(formData.get("employee_id") ?? "");
  const benefitPlanId = String(formData.get("benefit_plan_id") ?? "");

  if (!employeeId || !benefitPlanId) {
    return { error: "Choose an employee and a plan." };
  }

  const { error } = await supabase.from("employee_benefit_enrollments").insert({
    org_id: membership.orgId,
    employee_id: employeeId,
    benefit_plan_id: benefitPlanId,
    enrolled_by: user.id,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "This employee is already enrolled in that plan." : error.message,
    };
  }

  revalidatePath("/benefits");
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
    .from("employee_benefit_enrollments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  revalidatePath("/benefits");
}
