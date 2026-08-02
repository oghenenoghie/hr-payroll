"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { notifyUsers } from "@/lib/notifications";

export type FormState = { error?: string; success?: boolean } | null;

const MANAGING_ROLES = ["admin", "hr_manager", "department_manager"];

// A blank shiftTemplateId means "clear the assignment for this day" —
// deletes any existing row rather than inserting one, since a row
// with no shift wouldn't mean anything (unlike attendance_records, where
// the implicit default "present" is what an absent row means the
// opposite of).
export async function setShiftAssignment(employeeId: string, date: string, shiftTemplateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || !MANAGING_ROLES.includes(membership.role)) return;

  if (!shiftTemplateId) {
    await supabase.from("shift_assignments").delete().eq("employee_id", employeeId).eq("date", date);
    revalidatePath("/shifts");
    return;
  }

  const { data: employee } = await supabase.from("employees").select("user_id").eq("id", employeeId).maybeSingle();

  await supabase
    .from("shift_assignments")
    .upsert(
      {
        org_id: membership.orgId,
        employee_id: employeeId,
        shift_template_id: shiftTemplateId,
        date,
        assigned_by: user.id,
      },
      { onConflict: "employee_id,date" },
    );

  if (employee?.user_id) {
    await notifyUsers(supabase, {
      orgId: membership.orgId,
      recipientUserIds: [employee.user_id],
      type: "shift_assigned",
      message: `You've been scheduled for a shift on ${date}.`,
      link: "/shifts",
    });
  }

  revalidatePath("/shifts");
  revalidatePath("/me");
}

export async function createShiftTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to define shift types." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!name) return { error: "Enter a shift name." };
  if (!startTime || !endTime) return { error: "Enter a start and end time." };

  const { error } = await supabase.from("shift_templates").insert({
    org_id: membership.orgId,
    name,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: error.message };

  revalidatePath("/shifts/templates");
  revalidatePath("/shifts");
  return { success: true };
}

export async function deleteShiftTemplate(templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("shift_templates").delete().eq("id", templateId);

  revalidatePath("/shifts/templates");
  revalidatePath("/shifts");
}
