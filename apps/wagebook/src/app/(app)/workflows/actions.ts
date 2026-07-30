"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type AddWorkflowStepState = { error?: string } | null;

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

  const stepOrder = Number(formData.get("step_order") ?? 0);
  const approverKind = String(formData.get("approver_kind") ?? "");
  const approverRole = String(formData.get("approver_role") ?? "").trim() || null;
  const approverUserId = String(formData.get("approver_user_id") ?? "").trim() || null;

  if (!Number.isInteger(stepOrder) || stepOrder < 1) {
    return { error: "Step order must be a positive whole number." };
  }
  if (approverKind === "role" && !approverRole) {
    return { error: "Choose a role for this step." };
  }
  if (approverKind === "specific_user" && !approverUserId) {
    return { error: "Choose a person for this step." };
  }

  const { error } = await supabase.from("approval_workflow_steps").insert({
    org_id: membership.orgId,
    request_type: "leave_request",
    step_order: stepOrder,
    approver_kind: approverKind,
    approver_role: approverKind === "role" ? approverRole : null,
    approver_user_id: approverKind === "specific_user" ? approverUserId : null,
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
