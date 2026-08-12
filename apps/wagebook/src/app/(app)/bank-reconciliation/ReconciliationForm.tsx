"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createReconciliation } from "./actions";

export function ReconciliationForm() {
  const [state, formAction] = useActionState(createReconciliation, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Statement period end" name="period_end" type="date" />
        <FormField label="Statement ending balance (₦)" name="statement_balance" type="number" />
      </div>
      <SubmitButton>Start reconciliation</SubmitButton>
    </form>
  );
}
