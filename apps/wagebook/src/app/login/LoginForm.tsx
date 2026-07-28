"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  AuthDivider,
  FormError,
  FormField,
  FormNotice,
  GoogleButton,
  SubmitButton,
} from "@/components/AuthCard";
import { signIn, signInWithGoogle } from "./actions";

export function LoginForm({ message }: { message?: string }) {
  const [state, formAction] = useActionState(signIn, null);
  const [googleState, googleFormAction] = useActionState(signInWithGoogle, null);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <FormNotice message={message} />
        <FormError message={state?.error ?? googleState?.error} />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <AuthDivider label="Or" />
      <form action={googleFormAction}>
        <GoogleButton>Continue with Google</GoogleButton>
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
