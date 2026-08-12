"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { acknowledgeAppraisal, type FormState } from "./actions";

export function AcknowledgeAppraisalForm({ appraisalId }: { appraisalId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    acknowledgeAppraisal.bind(null, appraisalId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Acknowledged." : undefined} />
      <div className="flex flex-col gap-2">
        <label
          className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft"
          htmlFor={`employee-comments-${appraisalId}`}
        >
          Your comments (optional)
        </label>
        <textarea
          id={`employee-comments-${appraisalId}`}
          name="employee_comments"
          rows={2}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Acknowledge</SubmitButton>
    </form>
  );
}
