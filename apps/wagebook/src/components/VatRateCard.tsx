"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormError, FormNotice } from "@/components/AuthCard";
import { updateVatRate } from "@/lib/vatActions";

function UpdateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white disabled:opacity-50"
    >
      {pending ? "Saving…" : "Update"}
    </button>
  );
}

/** The org-wide VAT rate every invoice/bill computes VAT from — never
 * hardcoded, always read from organizations.vat_rate_scaled. Read-only for
 * anyone who isn't an admin, matching update_vat_rate()'s RLS scope. */
export function VatRateCard({ vatRateScaled, canEdit }: { vatRateScaled: number; canEdit: boolean }) {
  const [state, formAction] = useActionState(updateVatRate, null);
  const currentPercent = vatRateScaled / 10_000;

  if (!canEdit) {
    return (
      <div className="flex items-center justify-between rounded-card border border-border bg-surface p-4 text-[13px]">
        <span className="text-ink-soft">VAT rate</span>
        <span className="font-bold text-ink">{currentPercent.toLocaleString("en-NG")}%</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "VAT rate updated." : undefined} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="vat_percent" className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            VAT rate (%)
          </label>
          <input
            id="vat_percent"
            name="vat_percent"
            type="number"
            min="0"
            step="0.01"
            defaultValue={currentPercent}
            className="w-28 rounded-control border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <UpdateButton />
        <span className="text-[12px] text-ink-soft">Applied automatically to every new invoice and bill.</span>
      </div>
    </form>
  );
}
