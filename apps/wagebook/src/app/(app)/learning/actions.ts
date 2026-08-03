"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { notifyUsers } from "@/lib/notifications";

export type FormState = { error?: string; success?: boolean } | null;

const MANAGING_ROLES = ["admin", "hr_manager"];
const CATEGORIES = ["compliance", "onboarding", "skills", "safety", "other"];

export async function createCourse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGING_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to add training courses." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "other").trim();
  const isMandatory = formData.get("is_mandatory") === "on";
  const externalUrl = String(formData.get("external_url") ?? "").trim();

  if (!title) return { error: "Enter a course title." };
  if (!CATEGORIES.includes(category)) return { error: "Pick a category." };

  const { error } = await supabase.from("training_courses").insert({
    org_id: membership.orgId,
    title,
    description: description || null,
    category,
    is_mandatory: isMandatory,
    external_url: externalUrl || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/learning/courses");
  revalidatePath("/learning");
  return { success: true };
}

export async function deleteCourse(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The FK cascade on training_course_materials only removes the metadata
  // rows, not the underlying Storage objects — clean those up first so
  // deleting a course never leaves orphaned bytes in the bucket.
  const { data: materials } = await supabase
    .from("training_course_materials")
    .select("storage_path")
    .eq("course_id", courseId);
  if (materials && materials.length > 0) {
    await supabase.storage.from("training-materials").remove(materials.map((m) => m.storage_path));
  }

  await supabase.from("training_courses").delete().eq("id", courseId);

  revalidatePath("/learning/courses");
  revalidatePath("/learning");
}

export type UploadCourseMaterialState = { error?: string } | null;

const COURSE_MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

export async function uploadCourseMaterial(
  courseId: string,
  _prevState: UploadCourseMaterialState,
  formData: FormData,
): Promise<UploadCourseMaterialState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGING_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to upload course materials." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > COURSE_MATERIAL_MAX_BYTES) {
    return { error: "Files must be 20MB or smaller." };
  }

  const storagePath = `${membership.orgId}/${courseId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("training-materials").upload(storagePath, file);
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("training_course_materials").insert({
    org_id: membership.orgId,
    course_id: courseId,
    uploaded_by: user.id,
    file_name: file.name,
    storage_path: storagePath,
  });

  if (insertError) {
    // Metadata insert failed after a real upload succeeded — remove the
    // orphaned object rather than leaving a file with no listing entry.
    await supabase.storage.from("training-materials").remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath("/learning/courses");
  revalidatePath("/learning");
  return null;
}

export async function deleteCourseMaterial(materialId: string, storagePath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.storage.from("training-materials").remove([storagePath]);
  await supabase.from("training_course_materials").delete().eq("id", materialId);

  revalidatePath("/learning/courses");
  revalidatePath("/learning");
}

export async function enrollEmployee(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGING_ROLES.includes(membership.role)) {
    return { error: "You don't have permission to assign training." };
  }

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const courseId = String(formData.get("course_id") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!employeeId) return { error: "Pick an employee." };
  if (!courseId) return { error: "Pick a course." };

  const { data: course } = await supabase.from("training_courses").select("title").eq("id", courseId).maybeSingle();
  if (!course) return { error: "Course not found." };

  const { error } = await supabase.from("training_enrollments").insert({
    org_id: membership.orgId,
    employee_id: employeeId,
    course_id: courseId,
    assigned_by: user.id,
    due_date: dueDate || null,
  });

  if (error) return { error: error.message };

  const { data: employee } = await supabase.from("employees").select("user_id").eq("id", employeeId).maybeSingle();
  if (employee?.user_id) {
    await notifyUsers(supabase, {
      orgId: membership.orgId,
      recipientUserIds: [employee.user_id],
      type: "training_assigned",
      message: `You've been assigned a new training course: "${course.title}".`,
      link: "/learning",
    });
  }

  revalidatePath("/learning");
  return { success: true };
}

export async function deleteEnrollment(enrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("training_enrollments").delete().eq("id", enrollmentId);

  revalidatePath("/learning");
}

export async function markEnrollmentComplete(enrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("mark_training_enrollment_complete", { p_enrollment_id: enrollmentId });

  revalidatePath("/learning");
  revalidatePath("/me");
}
