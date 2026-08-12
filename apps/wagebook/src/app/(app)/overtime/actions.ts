"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";

async function notifyOvertimeDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  overtimeRequestId: string,
  decision: "approved" | "rejected",
) {
  const { data: request } = await supabase
    .from("overtime_requests")
    .select("org_id, employees(user_id)")
    .eq("id", overtimeRequestId)
    .maybeSingle();

  if (!request?.employees?.user_id) return;

  await notifyUsers(supabase, {
    orgId: request.org_id,
    recipientUserIds: [request.employees.user_id],
    type: decision === "approved" ? "overtime_approved" : "overtime_rejected",
    message:
      decision === "approved" ? "Your overtime request was approved." : "Your overtime request was rejected.",
    link: "/me",
  });
}

export async function approveOvertime(overtimeRequestId: string, rateMultiplierBps: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // review_overtime_request() only finalizes (and only then applies the
  // rate) on the last approval step — see its own comment.
  const { data: request } = await supabase.rpc("review_overtime_request", {
    p_overtime_request_id: overtimeRequestId,
    p_approve: true,
    p_rate_multiplier_bps: rateMultiplierBps,
  });

  if (request?.status === "approved") {
    await notifyOvertimeDecision(supabase, overtimeRequestId, "approved");
  }

  revalidatePath("/overtime");
}

export async function rejectOvertime(overtimeRequestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("review_overtime_request", { p_overtime_request_id: overtimeRequestId, p_approve: false });

  await notifyOvertimeDecision(supabase, overtimeRequestId, "rejected");

  revalidatePath("/overtime");
}
