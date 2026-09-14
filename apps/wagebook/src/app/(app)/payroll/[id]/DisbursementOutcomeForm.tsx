"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { recordDisbursementOutcome } from "./actions";

// Compact, per-payslip-row control — deliberately not a modal or a
// dedicated page, since this can repeat once per employee on a run with
// many payslips. "Settled" submits immediately (no reason needed);
// "Failed" reveals an inline reason field first, since
// record_payslip_disbursement_outcome requires a non-empty one.
export function DisbursementOutcomeForm({ payRunId, payslipId }: { payRunId: string; payslipId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordDisbursementOutcome.bind(null, payRunId, payslipId),
    null,
  );
  const [showFailureReason, setShowFailureReason] = useState(false);

  function submitSettled() {
    const formData = new FormData();
    formData.set("status", "settled");
    formAction(formData);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <FormError message={state?.error} />
      {!showFailureReason ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submitSettled}
            disabled={isPending}
            className="whitespace-nowrap rounded-button border border-good px-[10px] py-[4px] text-[11.5px] font-extrabold text-good disabled:opacity-50"
          >
            {isPending ? "Recording…" : "Mark settled"}
          </button>
          <button
            type="button"
            onClick={() => setShowFailureReason(true)}
            disabled={isPending}
            className="whitespace-nowrap rounded-button border border-bad px-[10px] py-[4px] text-[11.5px] font-extrabold text-bad disabled:opacity-50"
          >
            Mark failed
          </button>
        </div>
      ) : (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="status" value="failed" />
          <input
            name="failure_reason"
            required
            placeholder="Why did it fail?"
            className="w-[180px] rounded-control border border-border bg-surface px-[10px] py-[6px] text-[11.5px] text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={isPending}
            className="whitespace-nowrap rounded-button bg-bad px-[10px] py-[6px] text-[11.5px] font-extrabold text-white disabled:opacity-50"
          >
            {isPending ? "Recording…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setShowFailureReason(false)}
            className="text-[11.5px] font-bold text-ink-soft"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
