"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { approvePayRun, discardPayRunDraft } from "./actions";

export function PayRunDraftActions({ payRunId }: { payRunId: string }) {
  const [approveState, approveAction] = useActionState(approvePayRun.bind(null, payRunId), null);
  const [discardState, discardAction] = useActionState(discardPayRunDraft.bind(null, payRunId), null);
  // approve_pay_run() raises this exact message when the run has
  // unreviewed variance flags — seeing it once means the reviewer has
  // been stopped and shown the flags above; submitting again is treated
  // as the explicit acknowledgment to proceed anyway.
  const awaitingVarianceAck = Boolean(approveState?.error?.includes("unreviewed variance flag"));

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
        <form action={approveAction}>
          <input type="hidden" name="acknowledge_variance" value={awaitingVarianceAck ? "true" : "false"} />
          <SubmitButton>{awaitingVarianceAck ? "Acknowledge flags & approve anyway" : "Approve & post"}</SubmitButton>
        </form>
        <form action={discardAction}>
          <button
            type="submit"
            className="rounded-button border border-border px-[22px] py-[11px] text-[13px] font-extrabold text-bad"
          >
            Discard draft
          </button>
        </form>
      </div>
    </div>
  );
}
