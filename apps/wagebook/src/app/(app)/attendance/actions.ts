"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

const NEXT_STATUS: Record<string, "late" | "absent" | "present"> = {
  present: "late",
  late: "absent",
  absent: "present",
};

export async function cycleAttendance(employeeId: string, date: string, currentStatus: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return;
  }

  const next = NEXT_STATUS[currentStatus] ?? "late";

  if (next === "present") {
    await supabase.from("attendance_records").delete().eq("employee_id", employeeId).eq("date", date);
  } else {
    await supabase
      .from("attendance_records")
      .upsert(
        { org_id: membership.orgId, employee_id: employeeId, date, status: next, marked_by: user.id },
        { onConflict: "employee_id,date" },
      );
  }

  revalidatePath("/attendance");
  revalidatePath("/me");
}
