"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { scheduleInterview, type FormState } from "../actions";

export function ScheduleInterviewForm({
  candidateId,
  requisitionId,
  interviewers,
}: {
  candidateId: string;
  requisitionId: string;
  interviewers: { user_id: string; full_name: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    scheduleInterview.bind(null, candidateId, requisitionId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Interview scheduled." : undefined} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`interviewer-${candidateId}`}>
          Interviewer
        </label>
        <select
          id={`interviewer-${candidateId}`}
          name="interviewer_id"
          required
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="" disabled>
            Choose an interviewer
          </option>
          {interviewers.map((person) => (
            <option key={person.user_id} value={person.user_id}>
              {person.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`scheduled-${candidateId}`}>
          Date and time
        </label>
        <input
          id={`scheduled-${candidateId}`}
          name="scheduled_at"
          type="datetime-local"
          required
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`notes-${candidateId}`}>
          Notes
        </label>
        <textarea
          id={`notes-${candidateId}`}
          name="notes"
          rows={2}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Schedule interview</SubmitButton>
    </form>
  );
}
