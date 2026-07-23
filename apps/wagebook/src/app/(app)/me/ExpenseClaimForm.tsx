"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestExpense } from "./actions";

export function ExpenseClaimForm() {
  const [state, formAction] = useActionState(requestExpense, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Claim submitted." : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Amount (₦)" name="amount" type="number" />
        <FormField label="Description" name="description" />
      </div>
      <SubmitButton>Submit claim</SubmitButton>
    </form>
  );
}
