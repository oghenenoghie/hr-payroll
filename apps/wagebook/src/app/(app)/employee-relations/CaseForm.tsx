"use client";

import { useActionState } from "react";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createCase, type FormState } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function CaseForm({ employees }: { employees: { id: string; full_name: string }[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createCase, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Case opened." : undefined} />

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="employee_id">
          Employee
        </label>
        <select id="employee_id" name="employee_id" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select an employee
          </option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass} htmlFor="case_type">
            Case type
          </label>
          <select id="case_type" name="case_type" defaultValue="grievance" className={selectClass}>
            <option value="grievance">Grievance</option>
            <option value="disciplinary">Disciplinary</option>
            <option value="investigation">Investigation</option>
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass} htmlFor="severity">
            Severity
          </label>
          <select id="severity" name="severity" defaultValue="medium" className={selectClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <FormField label="Title" name="title" />

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="description">
          Description
        </label>
        <textarea id="description" name="description" rows={3} className={selectClass} />
      </div>

      <SubmitButton>Open case</SubmitButton>
    </form>
  );
}
