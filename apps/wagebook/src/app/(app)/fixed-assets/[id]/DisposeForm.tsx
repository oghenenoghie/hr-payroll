"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { disposeAsset } from "./actions";

export function DisposeForm({ assetId }: { assetId: string }) {
  const [state, formAction] = useActionState(disposeAsset, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="asset_id" value={assetId} />
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Disposal date" name="disposal_date" type="date" />
        <FormField label="Proceeds received (₦)" name="proceeds" type="number" required={false} />
      </div>
      <SubmitButton>Dispose of this asset</SubmitButton>
    </form>
  );
}
