"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { formatKobo } from "@/lib/format";
import { addEmployee } from "./actions";

type JobGrade = { id: string; name: string; min_annual_kobo: number; max_annual_kobo: number };

type Manager = { id: string; full_name: string };

export function EmployeeForm({
  departments,
  jobGrades,
  managers,
}: {
  departments: { id: string; name: string }[];
  jobGrades: JobGrade[];
  managers: Manager[];
}) {
  const [state, formAction] = useActionState(addEmployee, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Full name" name="full_name" />
      <FormField label="Email" name="email" type="email" required={false} />
      <FormField label="State of residence" name="state_of_residence" required={false} />
      <FormField label="Hire date" name="hire_date" type="date" required={false} />
      <FormField label="Probation end date" name="probation_end_date" type="date" required={false} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="employment_type">
            Employment type
          </label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue="permanent"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <FormField label="Contract end date" name="contract_end_date" type="date" required={false} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date of birth" name="date_of_birth" type="date" required={false} />
        <FormField label="Nationality" name="nationality" required={false} />
      </div>
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
              {grade.name} ({formatKobo(BigInt(grade.min_annual_kobo))} – {formatKobo(BigInt(grade.max_annual_kobo))})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="manager_id">
          Manager
        </label>
        <select
          id="manager_id"
          name="manager_id"
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="">No manager</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Basic (₦/yr)" name="basic" type="number" required={false} defaultValue="0" />
        <FormField label="Housing (₦/yr)" name="housing" type="number" required={false} defaultValue="0" />
        <FormField label="Transport (₦/yr)" name="transport" type="number" required={false} defaultValue="0" />
      </div>
      <FormField label="Annual rent paid (₦)" name="annual_rent" type="number" required={false} defaultValue="0" />
      <FormField label="TIN" name="tin" required={false} />
      <FormField label="PFA" name="pfa" required={false} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Bank name" name="bank_name" required={false} />
        <FormField label="Bank account number (NUBAN)" name="bank_account_number" required={false} />
      </div>
      <FormField label="Bank account name" name="bank_account_name" required={false} />
      <SubmitButton>Add employee</SubmitButton>
    </form>
  );
}
