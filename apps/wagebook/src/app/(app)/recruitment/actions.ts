"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { notifyUsers } from "@/lib/notifications";

export type FormState = { error?: string; success?: boolean } | null;

async function requireHrAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const membership = await getMembership(supabase, userId);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return null;
  }
  return membership;
}

export async function createRequisition(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await requireHrAccess(supabase, user.id);
  if (!membership) return { error: "You don't have permission to create a requisition." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Enter a job title." };

  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const jobGradeId = String(formData.get("job_grade_id") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  const { error } = await supabase.from("job_requisitions").insert({
    org_id: membership.orgId,
    title,
    department_id: departmentId,
    job_grade_id: jobGradeId,
    description,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/recruitment");
  return { success: true };
}

export async function updateRequisitionStatus(requisitionId: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("job_requisitions").update({ status }).eq("id", requisitionId);

  revalidatePath("/recruitment");
  revalidatePath(`/recruitment/${requisitionId}`);
}

export async function deleteRequisition(requisitionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("job_requisitions").delete().eq("id", requisitionId);

  revalidatePath("/recruitment");
}

export async function createCandidate(
  requisitionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await requireHrAccess(supabase, user.id);
  if (!membership) return { error: "You don't have permission to add a candidate." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Enter the candidate's name." };

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const resumeLink = String(formData.get("resume_link") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;

  const { error } = await supabase.from("candidates").insert({
    org_id: membership.orgId,
    requisition_id: requisitionId,
    full_name: fullName,
    email,
    phone,
    resume_link: resumeLink,
    source,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/recruitment/${requisitionId}`);
  return { success: true };
}

export async function updateCandidateStage(candidateId: string, requisitionId: string, stage: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("candidates")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  revalidatePath(`/recruitment/${requisitionId}`);
}

export async function rejectCandidate(
  candidateId: string,
  requisitionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const reason = String(formData.get("rejected_reason") ?? "").trim() || null;

  const { error } = await supabase
    .from("candidates")
    .update({ stage: "rejected", rejected_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  if (error) return { error: error.message };

  revalidatePath(`/recruitment/${requisitionId}`);
  return { success: true };
}

export async function scheduleInterview(
  candidateId: string,
  requisitionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await requireHrAccess(supabase, user.id);
  if (!membership) return { error: "You don't have permission to schedule an interview." };

  const interviewerUserId = String(formData.get("interviewer_id") ?? "").trim();
  const scheduledAt = String(formData.get("scheduled_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!interviewerUserId) return { error: "Pick an interviewer." };
  if (!scheduledAt) return { error: "Pick a date and time." };

  const { data: candidate } = await supabase
    .from("candidates")
    .select("full_name")
    .eq("id", candidateId)
    .maybeSingle();

  const { error } = await supabase.from("candidate_interviews").insert({
    org_id: membership.orgId,
    candidate_id: candidateId,
    interviewer_id: interviewerUserId,
    scheduled_at: new Date(scheduledAt).toISOString(),
    notes,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  await supabase
    .from("candidates")
    .update({ stage: "interviewing" })
    .eq("id", candidateId)
    .in("stage", ["applied", "screening"]);

  await notifyUsers(supabase, {
    orgId: membership.orgId,
    recipientUserIds: [interviewerUserId],
    type: "interview_scheduled",
    message: `You've been scheduled to interview ${candidate?.full_name ?? "a candidate"}.`,
    link: "/recruitment",
  });

  revalidatePath(`/recruitment/${requisitionId}`);
  revalidatePath("/recruitment");
  return { success: true };
}

export async function recordInterviewOutcome(
  interviewId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const outcome = String(formData.get("outcome") ?? "pending");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("candidate_interviews")
    .update({ outcome, notes })
    .eq("id", interviewId);

  if (error) return { error: error.message };

  revalidatePath("/recruitment");
  return { success: true };
}

export async function hireCandidate(candidateId: string, requisitionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await requireHrAccess(supabase, user.id);
  if (!membership) return;

  const { data: candidate } = await supabase
    .from("candidates")
    .select("full_name, email, stage")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate || candidate.stage === "hired") return;

  const { data: requisition } = await supabase
    .from("job_requisitions")
    .select("department_id, job_grade_id")
    .eq("id", requisitionId)
    .maybeSingle();

  // A bare HR record — compensation, banking, TIN and a login are left
  // for the existing Edit Employee page and Security & Access to fill
  // in afterward, the same two places that already own those steps for
  // any other new hire.
  const { data: newEmployee, error } = await supabase
    .from("employees")
    .insert({
      org_id: membership.orgId,
      full_name: candidate.full_name,
      email: candidate.email,
      department_id: requisition?.department_id ?? null,
      job_grade_id: requisition?.job_grade_id ?? null,
      hire_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !newEmployee) return;

  await supabase
    .from("candidates")
    .update({ stage: "hired", hired_employee_id: newEmployee.id, updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  await supabase.from("job_requisitions").update({ status: "filled" }).eq("id", requisitionId);

  revalidatePath(`/recruitment/${requisitionId}`);
  revalidatePath("/recruitment");
  revalidatePath("/employees");
}
