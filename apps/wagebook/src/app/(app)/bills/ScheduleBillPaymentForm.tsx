"use client";

import { useActionState, useState } from "react";
import { scheduleVendorBillPayment } from "./actions";

// An optional waypoint, not a required gate — "Pay now" (via
// ApprovedBillsTable's batch pay, or per-row) still works on an approved
// bill with no scheduling step at all. This only exists for the case
// where an org wants to queue a payment date ahead of actually sending
// the money, so paying is not confirmation-gated the way cancellation
// is (typing a date and clicking Schedule is already the deliberate
// step; a confirm dialog on top would be pure friction).
export function ScheduleBillPaymentForm({ billId }: { billId: string }) {
  const [state, formAction, isPending] = useActionState(scheduleVendorBillPayment.bind(null, billId), null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-bold text-primary">
        Schedule
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          name="payment_date"
          required
          min={new Date().toISOString().slice(0, 10)}
          className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-primary"
        />
        <button type="submit" disabled={isPending} className="text-[12px] font-bold text-primary disabled:opacity-50">
          {isPending ? "…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-ink-soft">
          ×
        </button>
      </div>
      {state?.error && <span className="text-[11px] text-bad">{state.error}</span>}
    </form>
  );
}
