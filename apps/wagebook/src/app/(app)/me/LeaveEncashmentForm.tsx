"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestLeaveEncashment } from "./actions";

export function LeaveEncashmentForm() {
  const [state, formAction] = useActionState(requestLeaveEncashment, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Leave encashment request submitted." : undefined} />
      <FormField label="Days to encash" name="days_requested" type="number" />
      <SubmitButton>Request encashment</SubmitButton>
    </form>
  );
}
