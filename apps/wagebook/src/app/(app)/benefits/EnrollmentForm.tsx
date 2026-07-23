"use client";

import { useActionState } from "react";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { enrollEmployee } from "./actions";

type Option = { id: string; label: string };

export function EnrollmentForm({ employees, plans }: { employees: Option[]; plans: Option[] }) {
  const [state, formAction] = useActionState(enrollEmployee, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Employee enrolled." : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Employee" name="employee_id" options={employees} />
        <Select label="Benefit plan" name="benefit_plan_id" options={plans} />
      </div>
      <SubmitButton>Enroll</SubmitButton>
    </form>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: Option[] }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required
        className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
