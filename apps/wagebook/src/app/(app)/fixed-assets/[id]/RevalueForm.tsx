"use client";

import { useActionState, useState } from "react";
import { FormError, FormField } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { revalueAsset } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function RevalueForm({ assetId }: { assetId: string }) {
  const [state, formAction, isPending] = useActionState(revalueAsset, null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPendingFormData(new FormData(event.currentTarget));
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="asset_id" value={assetId} />
        <FormError message={state?.error} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Revaluation date" name="revaluation_date" type="date" />
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="direction">
              Direction
            </label>
            <select id="direction" name="direction" defaultValue="up" className={selectClass}>
              <option value="up">Upward (increase cost)</option>
              <option value="down">Downward (decrease cost)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Adjustment amount (₦)" name="amount" type="number" />
          <FormField label="Note" name="note" required={false} />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Working…" : "Revalue asset"}
        </button>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Revalue this asset?"
          message="Adjusts the asset's carrying cost and posts a balancing entry to Revaluation Surplus. This can't be undone."
          confirmLabel="Revalue"
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
