"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createReviewCycle } from "./actions";

export function CycleForm() {
  const [state, formAction] = useActionState(createReviewCycle, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Review cycle created." : undefined} />
      <FormField label="Cycle name" name="name" />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Period start" name="period_start" type="date" />
        <FormField label="Period end" name="period_end" type="date" />
      </div>
      <SubmitButton>Add review cycle</SubmitButton>
    </form>
  );
}
