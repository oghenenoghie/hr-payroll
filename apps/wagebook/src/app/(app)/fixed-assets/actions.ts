"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type CreateAssetState = { error?: string } | null;

export async function createAsset(_prevState: CreateAssetState, formData: FormData): Promise<CreateAssetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to add fixed assets." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const acquisitionDate = String(formData.get("acquisition_date") ?? "").trim();
  const costNaira = Number(formData.get("cost") ?? 0);
  const salvageNaira = Number(formData.get("salvage_value") ?? 0);
  const usefulLifeMonths = Number(formData.get("useful_life_months") ?? 0);
  const depreciationMethod = String(formData.get("depreciation_method") ?? "straight_line").trim();
  const decliningBalanceRatePercent = Number(formData.get("declining_balance_rate_percent") ?? 0);
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;

  if (!name) {
    return { error: "Enter an asset name." };
  }
  if (!acquisitionDate) {
    return { error: "Enter an acquisition date." };
  }
  if (!costNaira || costNaira <= 0) {
    return { error: "Enter a cost greater than zero." };
  }
  if (salvageNaira < 0) {
    return { error: "Salvage value can't be negative." };
  }
  if (naira(salvageNaira) >= naira(costNaira)) {
    return { error: "Salvage value must be less than cost." };
  }
  if (!usefulLifeMonths || usefulLifeMonths <= 0) {
    return { error: "Enter a useful life in months greater than zero." };
  }
  if (depreciationMethod !== "straight_line" && depreciationMethod !== "declining_balance") {
    return { error: "Invalid depreciation method." };
  }
  if (
    depreciationMethod === "declining_balance" &&
    (!decliningBalanceRatePercent || decliningBalanceRatePercent <= 0 || decliningBalanceRatePercent > 100)
  ) {
    return { error: "Enter a declining-balance rate between 1 and 100." };
  }

  const { error } = await supabase.from("fixed_assets").insert({
    org_id: membership.orgId,
    name,
    category,
    acquisition_date: acquisitionDate,
    cost_kobo: Number(naira(costNaira)),
    salvage_value_kobo: Number(naira(salvageNaira)),
    useful_life_months: usefulLifeMonths,
    depreciation_method: depreciationMethod,
    declining_balance_rate_percent: depreciationMethod === "declining_balance" ? decliningBalanceRatePercent : null,
    department_id: departmentId,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/fixed-assets");
  return null;
}
