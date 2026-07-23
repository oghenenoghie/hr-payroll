"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";

async function notifyLeaveDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaveRequest: { org_id: string; employee_id: string } | null,
  decision: "approved" | "rejected",
) {
  if (!leaveRequest) return;

  const { data: employee } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", leaveRequest.employee_id)
    .maybeSingle();

  if (!employee?.user_id) return;

  await notifyUsers(supabase, {
    orgId: leaveRequest.org_id,
    recipientUserIds: [employee.user_id],
    type: decision === "approved" ? "leave_request_approved" : "leave_request_rejected",
    message:
      decision === "approved" ? "Your leave request was approved." : "Your leave request was rejected.",
    link: "/me",
  });
}

export async function approveLeave(leaveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: leaveRequest } = await supabase.rpc("review_leave_request", {
    p_leave_request_id: leaveId,
    p_approve: true,
  });

  await notifyLeaveDecision(supabase, leaveRequest, "approved");

  revalidatePath("/leave");
  revalidatePath("/team");
}

export async function rejectLeave(leaveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: leaveRequest } = await supabase.rpc("review_leave_request", {
    p_leave_request_id: leaveId,
    p_approve: false,
  });

  await notifyLeaveDecision(supabase, leaveRequest, "rejected");

  revalidatePath("/leave");
  revalidatePath("/team");
}
