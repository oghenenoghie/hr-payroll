"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { signIn } from "./actions";

export function LoginForm({ message }: { message?: string }) {
  const [state, formAction] = useActionState(signIn, null);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <FormNotice message={message} />
        <FormError message={state?.error} />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-soft">
        New to Plutus?{" "}
        <Link href="/signup" className="font-bold text-primary">
          Set up your company
        </Link>
      </p>
    </>
  );
}
