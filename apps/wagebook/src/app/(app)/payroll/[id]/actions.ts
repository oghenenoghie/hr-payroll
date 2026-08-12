"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
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

  const acknowledgeRemitted = formData.get("acknowledge_remitted") === "true";

  const { error } = await supabase.rpc("reverse_pay_run", {
    p_pay_run_id: payRunId,
    p_reason: reason,
    p_acknowledge_remitted: acknowledgeRemitted,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/payroll");
  return null;
}

export type RecordRemittanceState = { error?: string } | null;

export async function recordStatutoryRemittance(
  payRunId: string,
  _prevState: RecordRemittanceState,
  formData: FormData,
): Promise<RecordRemittanceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const scheme = String(formData.get("scheme") ?? "");
  const amountNaira = Number(formData.get("amount") ?? 0);
  const remittedOn = String(formData.get("remitted_on") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!amountNaira || amountNaira <= 0) {
    return { error: "Enter a remitted amount greater than zero." };
  }
  if (!remittedOn) {
    return { error: "A remittance date is required." };
  }

  const { error } = await supabase.rpc("record_statutory_remittance", {
    p_pay_run_id: payRunId,
    p_scheme: scheme,
    p_amount_kobo: Number(naira(amountNaira)),
    p_remitted_on: remittedOn,
    p_reference: reference || null,
    p_notes: notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  return null;
}
