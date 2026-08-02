"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { getOrgRoleUserIds, notifyUsers } from "@/lib/notifications";

export type FormState = { error?: string; success?: boolean } | null;

const CASE_TYPES = ["grievance", "disciplinary", "investigation"];
const SEVERITIES = ["low", "medium", "high"];

export async function createCase(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: "You don't have permission to open a case." };

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const caseType = String(formData.get("case_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const severity = String(formData.get("severity") ?? "medium").trim();

  if (!employeeId) return { error: "Pick the employee this case concerns." };
  if (!CASE_TYPES.includes(caseType)) return { error: "Pick a case type." };
  if (!title) return { error: "Enter a title." };
  if (!SEVERITIES.includes(severity)) return { error: "Pick a severity." };

  const { error } = await supabase.from("employee_relations_cases").insert({
    org_id: membership.orgId,
    employee_id: employeeId,
    case_type: caseType,
    title,
    description,
    severity,
    raised_by_user_id: user.id,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  // Keep HR in the loop when a department manager opens a case — never
  // notify the subject employee, since Employee Relations cases carry no
  // in-app visibility for the person they're about.
  if (membership.role === "department_manager") {
    const hrUserIds = await getOrgRoleUserIds(supabase, membership.orgId, ["admin", "hr_manager"]);
    await notifyUsers(supabase, {
      orgId: membership.orgId,
      recipientUserIds: hrUserIds,
      type: "employee_relations_case_opened",
      message: `A new ${caseType} case was opened: ${title}.`,
      link: "/employee-relations",
    });
  }

  revalidatePath("/employee-relations");
  return { success: true };
}

export async function addCaseNote(caseId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const note = String(formData.get("note") ?? "").trim();
  const actionType = String(formData.get("action_type") ?? "note").trim();

  if (!note) return { error: "Enter a note." };

  const { data: caseRow } = await supabase
    .from("employee_relations_cases")
    .select("org_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) return { error: "Case not found." };

  const { error } = await supabase.from("employee_relations_case_notes").insert({
    org_id: caseRow.org_id,
    case_id: caseId,
    author_user_id: user.id,
    action_type: actionType,
    note,
  });

  if (error) return { error: error.message };

  revalidatePath(`/employee-relations/${caseId}`);
  return { success: true };
}

export async function resolveCase(caseId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const resolution = String(formData.get("resolution") ?? "").trim();
  if (!resolution) return { error: "Describe how this case was resolved." };

  const { error } = await supabase.rpc("resolve_employee_relations_case", {
    p_case_id: caseId,
    p_resolution: resolution,
  });

  if (error) return { error: error.message };

  revalidatePath(`/employee-relations/${caseId}`);
  revalidatePath("/employee-relations");
  return { success: true };
}
