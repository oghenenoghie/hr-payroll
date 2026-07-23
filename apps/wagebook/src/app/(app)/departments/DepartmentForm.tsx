"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createDepartment } from "./actions";

export function DepartmentForm() {
  const [state, formAction] = useActionState(createDepartment, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Department created." : undefined} />
      <FormField label="Department name" name="name" />
      <SubmitButton>Add department</SubmitButton>
    </form>
  );
}
