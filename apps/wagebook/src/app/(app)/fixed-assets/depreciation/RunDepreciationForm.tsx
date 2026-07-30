"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { runDepreciation } from "./actions";

export function RunDepreciationForm() {
  const [state, formAction] = useActionState(runDepreciation, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormField label="Period end" name="period_end" type="date" />
      <SubmitButton>Run depreciation</SubmitButton>
    </form>
  );
}
