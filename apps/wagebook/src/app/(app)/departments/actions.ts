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
