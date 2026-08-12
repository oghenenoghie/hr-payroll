"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { recordInterviewOutcome, type FormState } from "./actions";

export function InterviewOutcomeForm({ interviewId, outcome, notes }: { interviewId: string; outcome: string; notes: string | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    recordInterviewOutcome.bind(null, interviewId),
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Saved." : undefined} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`outcome-${interviewId}`}>
          Outcome
        </label>
        <select
          id={`outcome-${interviewId}`}
          name="outcome"
          defaultValue={outcome}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="pending">Pending</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`notes-${interviewId}`}>
          Notes
        </label>
        <textarea
          id={`notes-${interviewId}`}
          name="notes"
          rows={2}
          defaultValue={notes ?? ""}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
