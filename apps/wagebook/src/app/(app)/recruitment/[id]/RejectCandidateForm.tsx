"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { rejectCandidate, type FormState } from "../actions";

export function RejectCandidateForm({ candidateId, requisitionId }: { candidateId: string; requisitionId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    rejectCandidate.bind(null, candidateId, requisitionId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Candidate rejected." : undefined} />
      <textarea
        name="rejected_reason"
        rows={2}
        placeholder="Reason (optional)"
        className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
      />
      <SubmitButton>Reject candidate</SubmitButton>
    </form>
  );
}
