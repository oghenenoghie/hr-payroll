"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { notifyUsers } from "@/lib/notifications";

export type ApplyRaiseState = { error?: string; success?: string } | null;

export async function applyRaise(_prevState: ApplyRaiseState, formData: FormData): Promise<ApplyRaiseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return { error: "Only an admin can apply an org-wide raise." };
  }

  const raisePercent = Number(formData.get("raisePercent"));
  if (!Number.isFinite(raisePercent) || raisePercent <= 0 || raisePercent > 50) {
    return { error: "Choose a raise between 1% and 50% on the slider before applying it." };
  }

  const { data: employeeCount, error } = await supabase.rpc("apply_org_wide_raise", {
    p_org_id: membership.orgId,
    p_raise_percent: raisePercent,
  });

  if (error) {
    return { error: error.message };
  }

  // Notify every affected employee's own account — a real pay change,
  // same as any other decision this app already surfaces to /me, not just
  // logged to the admin-only compensation-history audit trail.
  const { data: linkedEmployees } = await supabase
    .from("employees")
    .select("user_id")
    .eq("org_id", membership.orgId)
    .eq("status", "active")
    .not("user_id", "is", null);

  await notifyUsers(supabase, {
    orgId: membership.orgId,
    recipientUserIds: (linkedEmployees ?? []).map((e) => e.user_id!).filter(Boolean),
    type: "compensation_updated",
    message: `A company-wide ${raisePercent}% raise was applied to your pay.`,
    link: "/me",
  });

  revalidatePath("/simulation");
  revalidatePath("/employees");
  revalidatePath("/me");
  return { success: `Applied a ${raisePercent}% raise to ${employeeCount ?? 0} active employees.` };
}
