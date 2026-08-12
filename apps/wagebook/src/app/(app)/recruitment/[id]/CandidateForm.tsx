"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createCandidate, type FormState } from "../actions";

export function CandidateForm({ requisitionId }: { requisitionId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createCandidate.bind(null, requisitionId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Candidate added." : undefined} />
      <FormField label="Full name" name="full_name" />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email" name="email" type="email" required={false} />
        <FormField label="Phone" name="phone" required={false} />
      </div>
      <FormField label="Resume link" name="resume_link" required={false} />
      <FormField label="Source" name="source" required={false} />
      <SubmitButton>Add candidate</SubmitButton>
    </form>
  );
}
