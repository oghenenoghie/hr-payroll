"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { signUp } from "./actions";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, null);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <FormError message={state?.error} />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Continue</SubmitButton>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-primary">
          Sign in
        </Link>
      </p>
    </>
  );
}
