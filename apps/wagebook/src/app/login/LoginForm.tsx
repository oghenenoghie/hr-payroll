"use client";

import { useActionState } from "react";
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
        <FormField label="Email or Employee ID" name="identifier" type="text" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <AuthDivider label="Or" />
      <form action={googleFormAction}>
        <GoogleButton>Continue with Google</GoogleButton>
      </form>
    </>
  );
}
