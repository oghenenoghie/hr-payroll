"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createVendor } from "./actions";

export function VendorForm() {
  const [state, formAction] = useActionState(createVendor, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Vendor added." : undefined} />
      <FormField label="Vendor name" name="name" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contact email" name="contact_email" type="email" required={false} />
        <FormField label="Contact phone" name="contact_phone" required={false} />
      </div>
      <FormField label="Bank name" name="bank_name" required={false} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bank account number" name="bank_account_number" required={false} />
        <FormField label="Bank account name" name="bank_account_name" required={false} />
      </div>
      <SubmitButton>Add vendor</SubmitButton>
    </form>
  );
}
