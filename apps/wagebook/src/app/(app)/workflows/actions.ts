"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type AddWorkflowStepState = { error?: string } | null;

const REQUEST_TYPES = ["leave_request", "loan", "expense", "overtime_request", "leave_encashment_request", "bill"];

export async function addWorkflowStep(
  _prevState: AddWorkflowStepState,
  formData: FormData,
): Promise<AddWorkflowStepState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return { error: "Only Super Admin can configure approval workflows." };
  }

  const requestType = String(formData.get("request_type") ?? "");
  const stepOrder = Number(formData.get("step_order") ?? 0);
  const approverKind = String(formData.get("approver_kind") ?? "");
  const approverRole = String(formData.get("approver_role") ?? "").trim() || null;
  const approverUserId = String(formData.get("approver_user_id") ?? "").trim() || null;
  const minAmountNaira = String(formData.get("min_amount_naira") ?? "").trim();

  if (!REQUEST_TYPES.includes(requestType)) {
    return { error: "Unknown request type." };
  }
  if (!Number.isInteger(stepOrder) || stepOrder < 1) {
    return { error: "Step order must be a positive whole number." };
  }
  if (approverKind === "role" && !approverRole) {
    return { error: "Choose a role for this step." };
  }
  if (approverKind === "specific_user" && !approverUserId) {
    return { error: "Choose a person for this step." };
  }
  if ((approverKind === "reporting_manager" || approverKind === "department_manager") && requestType === "bill") {
    return { error: "Vendor bills aren't linked to an employee, so this approver kind never matches for bills." };
  }

  let minAmountKobo: number | null = null;
  if (requestType === "bill" && minAmountNaira) {
    const naira = Number(minAmountNaira);
    if (!Number.isFinite(naira) || naira < 0) {
      return { error: "Minimum bill amount must be a non-negative number." };
    }
    minAmountKobo = Math.round(naira * 100);
  }

  const { error } = await supabase.from("approval_workflow_steps").insert({
    org_id: membership.orgId,
    request_type: requestType,
    step_order: stepOrder,
    approver_kind: approverKind,
    approver_role: approverKind === "role" ? approverRole : null,
    approver_user_id: approverKind === "specific_user" ? approverUserId : null,
    min_amount_kobo: minAmountKobo,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/workflows");
  return null;
}

export async function deleteWorkflowStep(stepId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("approval_workflow_steps").delete().eq("id", stepId);

  revalidatePath("/workflows");
}
