"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { requestLeave } from "./actions";

export function LeaveRequestForm() {
  const [state, formAction] = useActionState(requestLeave, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Leave request submitted." : undefined} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="leave_type">
          Type
        </label>
        <select
          id="leave_type"
          name="leave_type"
          defaultValue="annual"
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="annual">Annual (paid)</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Start date" name="start_date" type="date" />
        <FormField label="End date" name="end_date" type="date" />
      </div>
      <FormField label="Reason" name="reason" required={false} />
      <SubmitButton>Request leave</SubmitButton>
    </form>
  );
}
