"use client";

import { useActionState } from "react";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createShiftTemplate, type FormState } from "../actions";

export function ShiftTemplateForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createShiftTemplate, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Shift type created." : undefined} />

      <FormField label="Name" name="name" />

      <div className="flex gap-3">
        <FormField label="Start time" name="start_time" type="time" />
        <FormField label="End time" name="end_time" type="time" />
      </div>

      <SubmitButton>Create shift type</SubmitButton>
    </form>
  );
}
