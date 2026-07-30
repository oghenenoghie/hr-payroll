"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { approvePayRun, discardPayRunDraft } from "./actions";

export function PayRunDraftActions({ payRunId }: { payRunId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approvePayRun.bind(null, payRunId), null);
  const [discardState, discardAction, discardPending] = useActionState(discardPayRunDraft.bind(null, payRunId), null);
  const [confirming, setConfirming] = useState<"approve" | "discard" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-soft">
        This run hasn&apos;t posted yet — nothing here is visible to employees, counted in reports, or carried
        forward into a future run&apos;s cumulative tax position until you approve it. Review the payslips and any
        variance flags below, then approve to post it or discard to undo it completely (loan balances and any
        expense/leave/attendance/overtime/encashment consumption this run applied are fully restored).
      </p>
      <FormError message={approveState?.error} />
      <FormError message={discardState?.error} />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming("approve")}
          disabled={approvePending || discardPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {approvePending ? "Working…" : "Approve & post"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming("discard")}
          disabled={approvePending || discardPending}
          className="rounded-button border border-border px-[22px] py-[11px] text-[13px] font-extrabold text-bad disabled:opacity-50"
        >
          {discardPending ? "Working…" : "Discard draft"}
        </button>
      </div>

      {confirming === "approve" && (
        <ConfirmDialog
          title="Approve and post this run?"
          message="This posts the run for real — it becomes visible to employees, counted in reports, and carries forward into future cumulative tax calculations. Once posted, correcting it means reversing rather than discarding."
          tone="primary"
          confirmLabel="Approve & post"
          onConfirm={() => {
            setConfirming(null);
            approveAction(new FormData());
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "discard" && (
        <ConfirmDialog
          title="Discard this draft?"
          message="Every side effect this run applied (loan repayments, expense/leave/attendance/overtime/encashment consumption) is fully restored, and the run itself is removed. This can't be undone."
          confirmLabel="Discard draft"
          onConfirm={() => {
            setConfirming(null);
            discardAction(new FormData());
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
