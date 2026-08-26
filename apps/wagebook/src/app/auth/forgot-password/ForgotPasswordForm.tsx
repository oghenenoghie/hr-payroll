"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);
  // Controlled, not defaultValue — same reasoning as every other AuthCard
  // form: an error re-render would otherwise clear whatever was typed,
  // and here that's the one field there is.
  const [email, setEmail] = useState("");

  if (state?.sent) {
    return (
      <FormNotice message="If an account exists for that email, a reset link is on its way. Check your inbox." />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Send reset link</SubmitButton>
      <Link href="/login" className="text-center text-[12.5px] font-bold text-primary">
        Back to sign in
      </Link>
    </form>
  );
}
