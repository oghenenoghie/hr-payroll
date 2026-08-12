"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { processFinalSettlement, type ProcessSettlementState } from "./actions";

export function SettleForm({ employeeId }: { employeeId: string }) {
  const [state, formAction, isPending] = useActionState(
    (prevState: ProcessSettlementState, formData: FormData) => processFinalSettlement(employeeId, prevState, formData),
    null,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
      >
        {isPending ? "Working…" : "Process final settlement"}
      </button>

      {confirming && (
        <ConfirmDialog
          title="Process this final settlement?"
          message="Pays out prorated final pay, leave payout, gratuity and clears any outstanding loan balance in one off-cycle run. This can't be undone."
          tone="primary"
          confirmLabel="Process settlement"
          onConfirm={() => {
            setConfirming(false);
            formAction(new FormData());
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
