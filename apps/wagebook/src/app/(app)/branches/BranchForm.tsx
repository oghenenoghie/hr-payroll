"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createBranch } from "./actions";

export function BranchForm() {
  const [state, formAction] = useActionState(createBranch, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Branch created." : undefined} />
      <FormField label="Branch name" name="name" />
      <FormField label="State" name="state" required={false} />
      <FormField label="Address" name="address" required={false} />
      <SubmitButton>Add branch</SubmitButton>
    </form>
  );
}
