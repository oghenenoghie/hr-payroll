"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { markPayRunPaid } from "./actions";

export function MarkPayRunPaidButton({ payRunId }: { payRunId: string }) {
  const [state, action, pending] = useActionState(markPayRunPaid.bind(null, payRunId), null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "Working…" : "Mark as paid"}
      </button>
      {confirming && (
        <ConfirmDialog
          title="Mark this run as paid?"
          message="This records that disbursement for this run has actually settled. It doesn't touch the ledger or any calculation, and can't be undone from here."
          tone="primary"
          confirmLabel="Mark as paid"
          onConfirm={() => {
            setConfirming(false);
            action(new FormData());
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
