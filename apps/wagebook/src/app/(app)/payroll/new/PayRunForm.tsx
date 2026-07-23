"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createPayRun } from "./actions";

export function PayRunForm() {
  const [state, formAction] = useActionState(createPayRun, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      {state?.missingTin && state.missingTin.length > 0 && (
        <div className="rounded-panel border border-bad bg-bad-tint px-3 py-2 text-[12.5px] font-bold text-bad">
          Missing TIN: {state.missingTin.join(", ")}
        </div>
      )}
      <FormField label="Period start" name="period_start" type="date" />
      <FormField label="Period end" name="period_end" type="date" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="frequency">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          defaultValue="monthly"
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="thirteenth_month">13th Month</option>
        </select>
        <p className="text-[11.5px] text-ink-soft">
          13th Month pays each active employee one month&apos;s basic salary, taxed on top of what they&apos;ve
          already earned this year. It doesn&apos;t apply leave, attendance, overtime or loan deductions.
        </p>
      </div>
      <SubmitButton>Run payroll</SubmitButton>
    </form>
  );
}
