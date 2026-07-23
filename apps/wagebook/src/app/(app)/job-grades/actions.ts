"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateJobGradeState = { error?: string; success?: boolean } | null;

export async function createJobGrade(
  _prevState: CreateJobGradeState,
  formData: FormData,
): Promise<CreateJobGradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to manage job grades." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const minNaira = Number(formData.get("min_annual") ?? 0);
  const maxNaira = Number(formData.get("max_annual") ?? 0);

  if (!name) {
    return { error: "Enter a job grade name." };
  }
  if (minNaira < 0 || maxNaira < 0) {
    return { error: "Salary band values can't be negative." };
  }
  if (maxNaira < minNaira) {
    return { error: "Maximum annual salary can't be less than the minimum." };
  }

  const { error } = await supabase.from("job_grades").insert({
    org_id: membership.orgId,
    name,
    min_annual_kobo: Number(naira(minNaira)),
    max_annual_kobo: Number(naira(maxNaira)),
  });

  if (error) {
    return {
      error: error.code === "23505" ? "A job grade with this name already exists." : error.message,
    };
  }

  revalidatePath("/job-grades");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return { success: true };
}

export async function deleteJobGrade(jobGradeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("job_grades").delete().eq("id", jobGradeId);

  revalidatePath("/job-grades");
  revalidatePath("/employees");
}
