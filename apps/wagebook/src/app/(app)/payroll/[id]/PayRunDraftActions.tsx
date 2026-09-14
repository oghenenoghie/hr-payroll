"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { validatePayRun, lockPayRun, discardPayRunDraft } from "./actions";

export function PayRunDraftActions({ payRunId, status }: { payRunId: string; status: "draft" | "validated" }) {
  const [validateState, validateAction, validatePending] = useActionState(validatePayRun.bind(null, payRunId), null);
  const [lockState, lockAction, lockPending] = useActionState(lockPayRun.bind(null, payRunId), null);
  const [discardState, discardAction, discardPending] = useActionState(discardPayRunDraft.bind(null, payRunId), null);
  const [confirming, setConfirming] = useState<"validate" | "lock" | "discard" | null>(null);

  // validate_pay_run() raises this exact message when the run has
  // unreviewed variance flags — seeing it once means the reviewer has
  // been stopped and shown the flags above; confirming again is treated
  // as the explicit acknowledgment to proceed anyway.
  const awaitingVarianceAck = Boolean(validateState?.error?.includes("unreviewed variance flag"));

  function submitValidate() {
    const formData = new FormData();
    formData.set("acknowledge_variance", awaitingVarianceAck ? "true" : "false");
    validateAction(formData);
  }

  if (status === "validated") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-soft">
          This run passed TIN and variance checks but isn&apos;t locked yet — nothing here is visible to employees,
          counted in reports, or carried forward into a future run&apos;s cumulative tax position until you lock it.
          Locking also freezes the rule version this run was calculated under.
        </p>
        <FormError message={lockState?.error} />
        <button
          type="button"
          onClick={() => setConfirming("lock")}
          disabled={lockPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {lockPending ? "Working…" : "Lock & post"}
        </button>
        {confirming === "lock" && (
          <ConfirmDialog
            title="Lock and post this run?"
            message="This posts the run for real — it becomes visible to employees, counted in reports, and carries forward into future cumulative tax calculations. The rule version it was calculated under becomes permanently frozen. Once locked, correcting it means reversing rather than discarding."
            tone="primary"
            confirmLabel="Lock & post"
            onConfirm={() => {
              setConfirming(null);
              lockAction(new FormData());
            }}
            onCancel={() => setConfirming(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-soft">
        This run hasn&apos;t posted yet — nothing here is visible to employees, counted in reports, or carried
        forward into a future run&apos;s cumulative tax position until you validate and lock it. Review the payslips
        and any variance flags below, then validate to clear TIN and variance checks (a separate lock step follows),
        or discard to undo it completely (loan balances and any expense/leave/attendance/overtime/encashment
        consumption this run applied are fully restored).
      </p>
      <FormError message={validateState?.error} />
      <FormError message={discardState?.error} />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming("validate")}
          disabled={validatePending || discardPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {validatePending
            ? "Working…"
            : awaitingVarianceAck
              ? "Acknowledge flags & validate anyway"
              : "Validate"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming("discard")}
          disabled={validatePending || discardPending}
          className="rounded-button border border-border px-[22px] py-[11px] text-[13px] font-extrabold text-bad disabled:opacity-50"
        >
          {discardPending ? "Working…" : "Discard draft"}
        </button>
      </div>

      {confirming === "validate" && (
        <ConfirmDialog
          title="Validate this run?"
          message={
            awaitingVarianceAck
              ? "This run has unreviewed variance flags — proceeding acknowledges them and validates anyway. A separate lock step is still needed before it posts for real."
              : "This clears TIN and variance checks. A separate lock step is still needed before the run posts for real and becomes visible to employees or reports."
          }
          tone="primary"
          confirmLabel={awaitingVarianceAck ? "Acknowledge flags & validate anyway" : "Validate"}
          onConfirm={() => {
            setConfirming(null);
            submitValidate();
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
