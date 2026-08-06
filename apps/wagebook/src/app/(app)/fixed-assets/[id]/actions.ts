"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type DisposeAssetState = { error?: string } | null;

export async function disposeAsset(_prevState: DisposeAssetState, formData: FormData): Promise<DisposeAssetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to dispose of a fixed asset." };
  }

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const disposalDate = String(formData.get("disposal_date") ?? "").trim();
  const proceedsNaira = Number(formData.get("proceeds") ?? 0);

  if (!assetId) {
    return { error: "Missing asset." };
  }
  if (!disposalDate) {
    return { error: "Enter a disposal date." };
  }
  if (proceedsNaira < 0) {
    return { error: "Proceeds can't be negative." };
  }

  const { error } = await supabase.rpc("dispose_fixed_asset", {
    p_asset_id: assetId,
    p_disposal_date: disposalDate,
    p_proceeds_kobo: Number(naira(proceedsNaira || 0)),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/fixed-assets/${assetId}`);
  revalidatePath("/fixed-assets");
  return null;
}
