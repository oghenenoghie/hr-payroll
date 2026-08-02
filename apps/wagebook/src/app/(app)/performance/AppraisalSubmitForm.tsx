"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { submitAppraisal, type FormState } from "./actions";

const textareaClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function AppraisalSubmitForm({ appraisalId }: { appraisalId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(submitAppraisal.bind(null, appraisalId), null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Appraisal submitted." : undefined} />
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor={`rating-${appraisalId}`}>
          Overall rating
        </label>
        <select
          id={`rating-${appraisalId}`}
          name="rating"
          required
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="" disabled>
            Choose a rating
          </option>
          <option value="1">1 — Needs improvement</option>
          <option value="2">2 — Below expectations</option>
          <option value="3">3 — Meets expectations</option>
          <option value="4">4 — Exceeds expectations</option>
          <option value="5">5 — Outstanding</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor={`strengths-${appraisalId}`}>
          Strengths
        </label>
        <textarea id={`strengths-${appraisalId}`} name="strengths" rows={2} className={textareaClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor={`areas-${appraisalId}`}>
          Areas for improvement
        </label>
        <textarea id={`areas-${appraisalId}`} name="areas_for_improvement" rows={2} className={textareaClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor={`comments-${appraisalId}`}>
          Manager comments
        </label>
        <textarea id={`comments-${appraisalId}`} name="manager_comments" rows={2} className={textareaClass} />
      </div>
      <SubmitButton>Submit appraisal</SubmitButton>
    </form>
  );
}
