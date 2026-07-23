"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createBenefitPlan } from "./actions";

const CATEGORY_OPTIONS = [
  { value: "health", label: "Health" },
  { value: "life", label: "Life" },
  { value: "pension_topup", label: "Pension top-up" },
  { value: "wellness", label: "Wellness" },
  { value: "other", label: "Other" },
];

export function BenefitPlanForm() {
  const [state, formAction] = useActionState(createBenefitPlan, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Benefit plan created." : undefined} />
      <FormField label="Plan name" name="name" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue="health"
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Employer cost / period (₦)" name="employer_cost" type="number" />
        <FormField label="Employee cost / period (₦)" name="employee_cost" type="number" required={false} />
      </div>
      <SubmitButton>Create plan</SubmitButton>
    </form>
  );
}
