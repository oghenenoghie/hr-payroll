"use client";

import { useActionState } from "react";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";
import { enrollEmployee, type FormState } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function EnrollForm({
  employees,
  courses,
}: {
  employees: { id: string; full_name: string }[];
  courses: { id: string; title: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(enrollEmployee, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Enrollment assigned." : undefined} />

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

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="course_id">
          Course
        </label>
        <select id="course_id" name="course_id" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      <FormField label="Due date (optional)" name="due_date" type="date" required={false} />

      <SubmitButton>Assign training</SubmitButton>
    </form>
  );
}
