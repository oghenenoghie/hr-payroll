"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateCycleState = { error?: string; success?: boolean } | null;

export async function createReviewCycle(
  _prevState: CreateCycleState,
  formData: FormData,
): Promise<CreateCycleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to manage review cycles." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");

  if (!name) return { error: "Enter a cycle name." };
  if (!periodStart || !periodEnd) return { error: "Enter a start and end date." };
  if (periodEnd < periodStart) return { error: "End date can't be before the start date." };

  const { error } = await supabase.from("performance_review_cycles").insert({
    org_id: membership.orgId,
    name,
    period_start: periodStart,
    period_end: periodEnd,
    created_by: user.id,
  });

  if (error) {
    return { error: error.code === "23505" ? "A review cycle with this name already exists." : error.message };
  }

  revalidatePath("/performance/cycles");
  revalidatePath("/performance");
  return { success: true };
}

export async function updateReviewCycleStatus(cycleId: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("performance_review_cycles").update({ status }).eq("id", cycleId);

  revalidatePath("/performance/cycles");
  revalidatePath("/performance");
}

export async function deleteReviewCycle(cycleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("performance_review_cycles").delete().eq("id", cycleId);

  revalidatePath("/performance/cycles");
  revalidatePath("/performance");
}
