"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { signIn } from "./actions";

export function LoginForm({ message }: { message?: string }) {
  const [state, formAction] = useActionState(signIn, null);
  // Controlled, not defaultValue — a failed sign-in re-renders this form
  // with an error, and an uncontrolled field resets on every render a
  // Server Action produces, success or not (see AuthCard's FormField
  // comment). Without this, a wrong password wipes the email/employee ID
  // the user already typed correctly, forcing them to retype it too.
  // Password itself stays uncontrolled: there's no reason to preserve one
  // that was just rejected.
  const [identifier, setIdentifier] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormNotice message={message} />
      <FormError message={state?.error} />
      <FormField
        label="Email or Employee ID"
        name="identifier"
        type="text"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
      />
      <FormField label="Password" name="password" type="password" />
      <div className="flex justify-end">
        <Link href="/auth/forgot-password" className="text-[12.5px] font-bold text-primary">
          Forgot password?
        </Link>
      </div>
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
