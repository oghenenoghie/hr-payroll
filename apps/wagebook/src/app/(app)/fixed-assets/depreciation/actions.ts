"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type RunDepreciationState = { error?: string } | null;

export async function runDepreciation(_prevState: RunDepreciationState, formData: FormData): Promise<RunDepreciationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to run depreciation." };
  }

  const periodEnd = String(formData.get("period_end") ?? "").trim();
  if (!periodEnd) {
    return { error: "Enter a period end date." };
  }

  const { data: run, error } = await supabase.rpc("run_depreciation", {
    p_org_id: membership.orgId,
    p_period_end: periodEnd,
  });

  if (error || !run) {
    return { error: error?.message ?? "Could not run depreciation." };
  }

  revalidatePath("/fixed-assets/depreciation");
  revalidatePath("/fixed-assets");
  redirect(`/fixed-assets/depreciation/${run.id}`);
}
