"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createBudget } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function BudgetForm() {
  const [state, formAction] = useActionState(createBudget, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Budget name" name="name" />
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="budget_type">
            Type
          </label>
          <select id="budget_type" name="budget_type" defaultValue="operating" className={selectClass}>
            <option value="operating">Operating (revenue &amp; expense)</option>
            <option value="capital">Capital (planned asset spend)</option>
            <option value="cash">Cash (planned obligations &amp; cash position)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Period start" name="period_start" type="date" />
        <FormField label="Period end" name="period_end" type="date" />
      </div>
      <SubmitButton>Create budget</SubmitButton>
    </form>
  );
}
