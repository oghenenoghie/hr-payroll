"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { setPassword } from "./actions";

export function SetPasswordForm() {
  const [state, formAction] = useActionState(setPassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Password" name="password" type="password" />
      <SubmitButton>Set password</SubmitButton>
    </form>
  );
}
