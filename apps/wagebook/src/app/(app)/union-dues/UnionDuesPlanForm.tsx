"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createUnionDuesPlan } from "./actions";

export function UnionDuesPlanForm() {
  const [state, formAction] = useActionState(createUnionDuesPlan, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Union dues plan created." : undefined} />
      <FormField label="Union name" name="name" />
      <FormField label="Due amount / period (₦)" name="amount" type="number" />
      <SubmitButton>Create plan</SubmitButton>
    </form>
  );
}
