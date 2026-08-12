"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createCustomer } from "./actions";

export function CustomerForm() {
  const [state, formAction] = useActionState(createCustomer, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Customer added." : undefined} />
      <FormField label="Customer name" name="name" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contact email" name="contact_email" type="email" required={false} />
        <FormField label="Contact phone" name="contact_phone" required={false} />
      </div>
      <FormField label="Billing address" name="billing_address" required={false} />
      <SubmitButton>Add customer</SubmitButton>
    </form>
  );
}
