"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  const [state, formAction] = useActionState(createOrganization, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Company name" name="name" />
      <SubmitButton>Create organization</SubmitButton>
    </form>
  );
}
