"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { runDepreciation } from "./actions";

export function RunDepreciationForm() {
  const [state, formAction] = useActionState(runDepreciation, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Period start" name="period_start" type="date" />
        <FormField label="Period end" name="period_end" type="date" />
      </div>
      <SubmitButton>Run depreciation</SubmitButton>
    </form>
  );
}
