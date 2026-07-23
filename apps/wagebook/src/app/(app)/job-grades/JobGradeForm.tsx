"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createJobGrade } from "./actions";

export function JobGradeForm() {
  const [state, formAction] = useActionState(createJobGrade, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Job grade created." : undefined} />
      <FormField label="Job grade name" name="name" />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Min annual salary (₦)" name="min_annual" type="number" />
        <FormField label="Max annual salary (₦)" name="max_annual" type="number" />
      </div>
      <SubmitButton>Add job grade</SubmitButton>
    </form>
  );
}
