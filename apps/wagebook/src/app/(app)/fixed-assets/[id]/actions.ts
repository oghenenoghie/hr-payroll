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

export type TransferAssetState = { error?: string } | null;

export async function transferAsset(_prevState: TransferAssetState, formData: FormData): Promise<TransferAssetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to transfer a fixed asset." };
  }

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const toDepartmentId = String(formData.get("to_department_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!assetId) {
    return { error: "Missing asset." };
  }

  const { error } = await supabase.rpc("transfer_fixed_asset", {
    p_asset_id: assetId,
    p_to_department_id: toDepartmentId,
    p_note: note,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/fixed-assets/${assetId}`);
  revalidatePath("/fixed-assets");
  return null;
}

export type RevalueAssetState = { error?: string } | null;

export async function revalueAsset(_prevState: RevalueAssetState, formData: FormData): Promise<RevalueAssetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return { error: "You don't have permission to revalue a fixed asset." };
  }

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const revaluationDate = String(formData.get("revaluation_date") ?? "").trim();
  const direction = String(formData.get("direction") ?? "up").trim();
  const amountNaira = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!assetId) {
    return { error: "Missing asset." };
  }
  if (!revaluationDate) {
    return { error: "Enter a revaluation date." };
  }
  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter an adjustment amount greater than zero." };
  }

  const adjustmentKobo = Number(naira(amountNaira)) * (direction === "down" ? -1 : 1);

  const { error } = await supabase.rpc("revalue_fixed_asset", {
    p_asset_id: assetId,
    p_adjustment_kobo: adjustmentKobo,
    p_revaluation_date: revaluationDate,
    p_note: note,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/fixed-assets/${assetId}`);
  revalidatePath("/fixed-assets");
  return null;
}
