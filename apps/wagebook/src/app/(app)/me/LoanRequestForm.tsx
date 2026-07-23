"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestLoan } from "./actions";

export function LoanRequestForm() {
  const [state, formAction] = useActionState(requestLoan, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Loan request submitted." : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Amount (₦)" name="principal" type="number" />
        <FormField label="Monthly repayment (₦)" name="monthly_repayment" type="number" />
      </div>
      <FormField label="Reason" name="reason" required={false} />
      <SubmitButton>Request loan</SubmitButton>
    </form>
  );
}
