"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatKobo } from "@/lib/format";
import { reversePayRun } from "./actions";

export function ReversalForm({
  payRunId,
  remittedSchemes,
}: {
  payRunId: string;
  // Schemes with at least one recorded statutory_remittances row against
  // this run — reverse_pay_run itself re-checks this server-side (the
  // real gate), so this list only drives the warning and the checkbox
  // that has to be checked before the form will even submit.
  remittedSchemes: { label: string; amountKobo: bigint; remittedOn: string }[];
}) {
  const [state, formAction, isPending] = useActionState(reversePayRun.bind(null, payRunId), null);
  // Captured on submit (after the browser's own "reason is required"
  // validation already passed) and only actually dispatched once the
  // confirm dialog is accepted.
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const hasRemittances = remittedSchemes.length > 0;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("acknowledge_remitted", hasRemittances && acknowledged ? "true" : "false");
          setPendingFormData(formData);
        }}
        className="flex flex-col gap-3"
      >
        <FormError message={state?.error} />
        <p className="text-[13px] text-ink-soft">
          Posts a correcting journal entry that exactly reverses this run&apos;s ledger impact — the original postings
          and payslips are never edited. Loan balances, and expense/leave/attendance/overtime/leave-encashment
          approvals this run consumed, are restored to a re-payable state. This does not address whether a reversal
          after a filing deadline requires an amended filing.
        </p>

        {hasRemittances && (
          <div className="rounded-panel border border-warn bg-warn-tint p-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-warn">
              Already remitted to a tax or pension authority
            </span>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-ink">
              {remittedSchemes.map((scheme) => (
                <li key={scheme.label}>
                  {scheme.label}: {formatKobo(scheme.amountKobo)} remitted {scheme.remittedOn}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-soft">
              Reversing corrects the ledger but does not undo that payment — the money already left the business for
              this filing. Whether an amended filing is required with the relevant authority isn&apos;t addressed by
              this system; confirm that separately.
            </p>
            <label className="mt-3 flex items-start gap-2 text-[12.5px] text-ink">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-[3px]"
              />
              I understand this run has already-remitted statutory liabilities and will handle any amended filing
              outside this system.
            </label>
          </div>
        )}

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
          disabled={isPending || (hasRemittances && !acknowledged)}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Working…" : "Reverse pay run"}
        </button>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Reverse this pay run?"
          message="Posts a correcting journal entry and restores every side effect this run consumed. The original postings and payslips stay untouched, but this is a significant correction."
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
