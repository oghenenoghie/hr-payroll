"use client";

import { useActionState, useState } from "react";
import { FormError, FormField } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { disposeAsset } from "./actions";

export function DisposeForm({ assetId }: { assetId: string }) {
  const [state, formAction, isPending] = useActionState(disposeAsset, null);
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
          <FormField label="Disposal date" name="disposal_date" type="date" />
          <FormField label="Proceeds received (₦)" name="proceeds" type="number" required={false} />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Working…" : "Dispose of this asset"}
        </button>
      </form>

      {pendingFormData && (
        <ConfirmDialog
          title="Dispose of this asset?"
          message="Removes its cost and accumulated depreciation from the books, records any proceeds received, and posts the resulting gain or loss on disposal. This can't be undone."
          confirmLabel="Dispose"
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
