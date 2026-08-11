"use client";

import { useActionState, useState } from "react";
import { FormError, FormField } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { recordStatutoryRemittance } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

// A record-keeping form, not a payment integration — this doesn't send
// money anywhere. It exists so reverse_pay_run has something real to
// check before correcting a run whose statutory liabilities have
// already left the business (see the reversal migration's comment).
export function RecordRemittanceForm({
  payRunId,
  schemes,
}: {
  payRunId: string;
  schemes: { value: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(recordStatutoryRemittance.bind(null, payRunId), null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  if (schemes.length === 0) return null;

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
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="scheme">
              Scheme
            </label>
            <select id="scheme" name="scheme" required className={selectClass} defaultValue={schemes[0].value}>
              {schemes.map((scheme) => (
                <option key={scheme.value} value={scheme.value}>
                  {scheme.label}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Amount remitted (₦)" name="amount" type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date remitted" name="remitted_on" type="date" />
          <FormField label="Reference / receipt no." name="reference" required={false} />
        </div>
        <FormField label="Notes" name="notes" required={false} />
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-button border border-border px-[22px] py-[11px] text-[13px] font-extrabold text-ink disabled:opacity-50"
        >
          {isPending ? "Recording…" : "Record remittance"}
        </button>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Record this remittance?"
          message="This records that the amount has already been paid to the relevant authority — it's a record of what happened, not a payment made by this system. It also means reversing this pay run later will require explicitly acknowledging that this remittance already went out."
          confirmLabel="Record"
          tone="primary"
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
