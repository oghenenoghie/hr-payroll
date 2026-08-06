"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { addCaseNote, type FormState } from "../actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function CaseNoteForm({ caseId }: { caseId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    (prevState, formData) => addCaseNote(caseId, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Note added." : undefined} />

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="action_type">
          Action
        </label>
        <select id="action_type" name="action_type" defaultValue="note" className={selectClass}>
          <option value="note">Note</option>
          <option value="warning_issued">Warning issued</option>
          <option value="meeting_held">Meeting held</option>
          <option value="escalated">Escalated</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="note">
          Note
        </label>
        <textarea id="note" name="note" rows={3} required className={selectClass} />
      </div>

      <SubmitButton>Add note</SubmitButton>
    </form>
  );
}
