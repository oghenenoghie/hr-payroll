"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createRequisition } from "./actions";

export function RequisitionForm({
  departments,
  jobGrades,
}: {
  departments: { id: string; name: string }[];
  jobGrades: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createRequisition, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Requisition created." : undefined} />
      <FormField label="Job title" name="title" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="department_id">
          Department
        </label>
        <select
          id="department_id"
          name="department_id"
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="">No department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="job_grade_id">
          Job grade
        </label>
        <select
          id="job_grade_id"
          name="job_grade_id"
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="">No job grade</option>
          {jobGrades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Create requisition</SubmitButton>
    </form>
  );
}
