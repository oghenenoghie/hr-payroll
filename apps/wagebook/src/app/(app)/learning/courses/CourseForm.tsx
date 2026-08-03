"use client";

import { useActionState } from "react";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createCourse, type FormState } from "../actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function CourseForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createCourse, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Course added." : undefined} />

      <FormField label="Course title" name="title" />

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="description">
          Description
        </label>
        <textarea id="description" name="description" rows={3} className={selectClass} />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass} htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue="other" className={selectClass}>
            <option value="compliance">Compliance</option>
            <option value="onboarding">Onboarding</option>
            <option value="skills">Skills</option>
            <option value="safety">Safety</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex flex-1 items-end pb-[11px]">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="is_mandatory" className="h-4 w-4" />
            Mandatory
          </label>
        </div>
      </div>

      <FormField label="Link to material (optional)" name="external_url" required={false} />

      <SubmitButton>Add course</SubmitButton>
    </form>
  );
}
