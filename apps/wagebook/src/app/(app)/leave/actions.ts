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

async function notifyLeaveEncashmentDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: { org_id: string; employee_id: string } | null,
  decision: "approved" | "rejected",
) {
  if (!request) return;

  const { data: employee } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", request.employee_id)
    .maybeSingle();

  if (!employee?.user_id) return;

  await notifyUsers(supabase, {
    orgId: request.org_id,
    recipientUserIds: [employee.user_id],
    type: decision === "approved" ? "leave_encashment_approved" : "leave_encashment_rejected",
    message:
      decision === "approved"
        ? "Your leave encashment request was approved."
        : "Your leave encashment request was rejected.",
    link: "/me",
  });
}

export async function approveLeaveEncashment(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Silently no-ops on failure (e.g. insufficient balance at approval time)
  // — same pattern as every other approve/reject action in this file, none
  // of which surface RPC errors back to these bind-style buttons.
  const { data: request } = await supabase.rpc("review_leave_encashment_request", {
    p_request_id: requestId,
    p_approve: true,
  });

  await notifyLeaveEncashmentDecision(supabase, request, "approved");

  revalidatePath("/leave");
}

export async function rejectLeaveEncashment(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: request } = await supabase.rpc("review_leave_encashment_request", {
    p_request_id: requestId,
    p_approve: false,
  });

  await notifyLeaveEncashmentDecision(supabase, request, "rejected");

  revalidatePath("/leave");
}
