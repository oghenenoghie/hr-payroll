"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ApprovePayRunState = { error?: string } | null;

export async function approvePayRun(
  payRunId: string,
  _prevState: ApprovePayRunState,
  formData: FormData,
): Promise<ApprovePayRunState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const acknowledgeVariance = formData.get("acknowledge_variance") === "true";

  const { error } = await supabase.rpc("approve_pay_run", {
    p_pay_run_id: payRunId,
    p_acknowledge_variance: acknowledgeVariance,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/payroll");
  revalidatePath("/reports");
  revalidatePath("/reports/register");
  return null;
}

export type DiscardPayRunDraftState = { error?: string } | null;

export async function discardPayRunDraft(
  payRunId: string,
  _prevState: DiscardPayRunDraftState,
  _formData: FormData,
): Promise<DiscardPayRunDraftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("discard_pay_run_draft", { p_pay_run_id: payRunId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/payroll");
  revalidatePath("/loans");
  revalidatePath("/expenses");
  revalidatePath("/leave");
  revalidatePath("/attendance");
  revalidatePath("/overtime");
  redirect("/payroll");
}

export type ReversePayRunState = { error?: string } | null;

export async function reversePayRun(
  payRunId: string,
  _prevState: ReversePayRunState,
  formData: FormData,
): Promise<ReversePayRunState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { error: "A reason is required to reverse a pay run." };
  }

  const { error } = await supabase.rpc("reverse_pay_run", { p_pay_run_id: payRunId, p_reason: reason });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/payroll");
  return null;
}
