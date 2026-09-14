"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";

export type ValidatePayRunState = { error?: string } | null;

// draft -> validated: variance-flag acknowledgment (same gate approve_pay_run
// used to apply) plus a fresh TIN re-check against current employee records.
export async function validatePayRun(
  payRunId: string,
  _prevState: ValidatePayRunState,
  formData: FormData,
): Promise<ValidatePayRunState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const acknowledgeVariance = formData.get("acknowledge_variance") === "true";

  const { error } = await supabase.rpc("validate_pay_run", {
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

export type LockPayRunState = { error?: string } | null;

// validated -> locked (stored as status = 'posted' — see the migration
// comment for why this isn't a fourth status value). This is the moment
// the run actually becomes visible to reports/reconciliation/tax
// certificates/GL export, and rule_version_id becomes immutable.
export async function lockPayRun(
  payRunId: string,
  _prevState: LockPayRunState,
  _formData: FormData,
): Promise<LockPayRunState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("lock_pay_run", { p_pay_run_id: payRunId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/payroll");
  revalidatePath("/reports");
  revalidatePath("/reports/register");
  return null;
}

export type MarkPayRunPaidState = { error?: string } | null;

// locked -> paid (tracked as disbursed_by/disbursed_at, not a status
// value — see migration comment). Purely a disbursement-confirmed record;
// doesn't touch any calculation or the ledger.
export async function markPayRunPaid(
  payRunId: string,
  _prevState: MarkPayRunPaidState,
  _formData: FormData,
): Promise<MarkPayRunPaidState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("mark_pay_run_paid", { p_pay_run_id: payRunId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
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

export type RecordDisbursementOutcomeState = { error?: string } | null;

export async function recordDisbursementOutcome(
  payRunId: string,
  payslipId: string,
  _prevState: RecordDisbursementOutcomeState,
  formData: FormData,
): Promise<RecordDisbursementOutcomeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const status = String(formData.get("status") ?? "");
  const failureReason = String(formData.get("failure_reason") ?? "").trim();

  if (status !== "settled" && status !== "failed") {
    return { error: "Invalid disbursement status." };
  }
  if (status === "failed" && !failureReason) {
    return { error: "Enter a reason the transfer failed." };
  }

  const { error } = await supabase.rpc("record_payslip_disbursement_outcome", {
    p_payslip_id: payslipId,
    p_status: status,
    p_failure_reason: status === "failed" ? failureReason : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  return null;
}
