"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createAsset } from "./actions";

export function AssetForm() {
  const [state, formAction] = useActionState(createAsset, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Asset name" name="name" />
        <FormField label="Category" name="category" required={false} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Acquisition date" name="acquisition_date" type="date" />
        <FormField label="Useful life (months)" name="useful_life_months" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Cost (₦)" name="cost" type="number" />
        <FormField label="Salvage value (₦)" name="salvage_value" type="number" required={false} />
      </div>
      <SubmitButton>Add asset</SubmitButton>
    </form>
  );
}
