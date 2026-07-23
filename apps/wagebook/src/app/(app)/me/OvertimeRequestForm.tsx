"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestOvertime } from "./actions";

export function OvertimeRequestForm() {
  const [state, formAction] = useActionState(requestOvertime, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Overtime request submitted." : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" name="work_date" type="date" />
        <FormField label="Hours" name="hours" type="number" />
      </div>
      <FormField label="Reason" name="reason" required={false} />
      <SubmitButton>Submit request</SubmitButton>
    </form>
  );
}
