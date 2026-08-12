"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { cancelVendorBill } from "./actions";

// Cancelling reverses a posted journal entry if one exists (see
// cancel_vendor_bill) — that's real, irreversible ledger activity, so
// this follows the same capture-reason-then-confirm shape as payroll
// reversal's ReversalForm, not the lighter reveal-inline pattern
// ScheduleBillPaymentForm uses for a non-destructive action.
export function CancelBillForm({ billId, billDescription }: { billId: string; billDescription: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await cancelVendorBill(billId, null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      showToast("Bill cancelled", "good");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-bold text-bad">
        Cancel
      </button>
    );
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPendingFormData(new FormData(event.currentTarget));
        }}
        className="flex flex-col items-end gap-1"
      >
        {error && <span className="text-[11px] text-bad">{error}</span>}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            name="reason"
            required
            placeholder="Reason for cancelling"
            className="w-[160px] rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-primary"
          />
          <button type="submit" disabled={isPending} className="text-[12px] font-bold text-bad disabled:opacity-50">
            {isPending ? "…" : "Cancel bill"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-ink-soft">
            ×
          </button>
        </div>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Cancel this bill?"
          message={`"${billDescription}" will be cancelled. If it was already approved, the posted journal entry is reversed with a new correcting entry — the original stays on record. This can't be undone.`}
          confirmLabel="Cancel bill"
          onConfirm={() => {
            const formData = pendingFormData;
            setPendingFormData(null);
            submit(formData);
          }}
          onCancel={() => setPendingFormData(null)}
        />
      )}
    </>
  );
}
