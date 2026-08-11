"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type UpdateVatRateState = { error?: string; success?: boolean } | null;

/** Admin-only, matching the existing "org admins can update their
 * organization" RLS policy the update_vat_rate() RPC relies on (see the
 * migration) — organization-level settings stay admin-only here, unlike
 * the admin/payroll_manager write scope everywhere else in AP/AR. */
export async function updateVatRate(_prevState: UpdateVatRateState, formData: FormData): Promise<UpdateVatRateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "Only an admin can change the VAT rate." };
  }

  const percent = Number(formData.get("vat_percent") ?? NaN);
  if (!Number.isFinite(percent) || percent < 0) {
    return { error: "Enter a VAT rate of zero or more." };
  }

  // Inverse of formatPercent's rateScaled / 10_000 display formula.
  const { error } = await supabase.rpc("update_vat_rate", {
    p_org_id: membership.orgId,
    p_vat_rate_scaled: Math.round(percent * 10_000),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/invoices");
  revalidatePath("/bills");
  return { success: true };
}
