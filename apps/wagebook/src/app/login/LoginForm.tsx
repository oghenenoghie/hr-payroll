"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { signIn } from "./actions";

export function LoginForm({ message }: { message?: string }) {
  const [state, formAction] = useActionState(signIn, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormNotice message={message} />
      <FormError message={state?.error} />
      <FormField label="Email or Employee ID" name="identifier" type="text" />
      <FormField label="Password" name="password" type="password" />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
