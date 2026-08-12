"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { resolveCase, type FormState } from "../actions";

const textareaClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function ResolveCaseForm({ caseId }: { caseId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    (prevState, formData) => resolveCase(caseId, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Case resolved." : undefined} />

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="resolution">
          How was this resolved?
        </label>
        <textarea id="resolution" name="resolution" rows={3} required className={textareaClass} />
      </div>

      <SubmitButton>Resolve case</SubmitButton>
    </form>
  );
}
