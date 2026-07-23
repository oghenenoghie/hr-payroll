"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveLeave(leaveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("review_leave_request", { p_leave_request_id: leaveId, p_approve: true });

  revalidatePath("/leave");
}

export async function rejectLeave(leaveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("review_leave_request", { p_leave_request_id: leaveId, p_approve: false });

  revalidatePath("/leave");
}
