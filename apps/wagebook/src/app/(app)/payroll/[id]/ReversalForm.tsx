"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { reversePayRun } from "./actions";

export function ReversalForm({ payRunId }: { payRunId: string }) {
  const [state, formAction, isPending] = useActionState(reversePayRun.bind(null, payRunId), null);
  // Captured on submit (after the browser's own "reason is required"
  // validation already passed) and only actually dispatched once the
  // confirm dialog is accepted.
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPendingFormData(new FormData(event.currentTarget));
        }}
        className="flex flex-col gap-3"
      >
        <FormError message={state?.error} />
        <p className="text-[13px] text-ink-soft">
          Posts a correcting journal entry that exactly reverses this run&apos;s ledger impact — the original postings
          and payslips are never edited. Loan balances, and expense/leave/attendance/overtime/leave-encashment
          approvals this run consumed, are restored to a re-payable state. This does not address amounts already
          remitted to a tax or pension authority, or whether a reversal after a filing deadline requires an amended
          filing.
        </p>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="reason">
            Reason (required)
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={2}
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Working…" : "Reverse pay run"}
        </button>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Reverse this pay run?"
          message="Posts a correcting journal entry and restores every side effect this run consumed. The original postings and payslips stay untouched, but this is a significant correction — it doesn't address amounts already remitted to a tax or pension authority."
          confirmLabel="Reverse pay run"
          onConfirm={() => {
            const formData = pendingFormData;
            setPendingFormData(null);
            formAction(formData);
          }}
          onCancel={() => setPendingFormData(null)}
        />
      )}
    </>
  );
}
