"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createBudget } from "./actions";

export function BudgetForm() {
  const [state, formAction] = useActionState(createBudget, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormField label="Budget name" name="name" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Period start" name="period_start" type="date" />
        <FormField label="Period end" name="period_end" type="date" />
      </div>
      <SubmitButton>Create budget</SubmitButton>
    </form>
  );
}
