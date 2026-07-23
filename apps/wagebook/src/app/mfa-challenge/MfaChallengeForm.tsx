"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { verifyMfaChallenge } from "./actions";

export function MfaChallengeForm({ factorId }: { factorId: string }) {
  const verifyWithFactor = verifyMfaChallenge.bind(null, factorId);
  const [state, formAction] = useActionState(verifyWithFactor, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormField label="6-digit code" name="code" />
      <SubmitButton>Verify</SubmitButton>
    </form>
  );
}
