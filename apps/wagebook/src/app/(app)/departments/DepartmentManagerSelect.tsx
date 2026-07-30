"use client";

import { useActionState } from "react";
import { setDepartmentManager, type SetDepartmentManagerState } from "./actions";

export function DepartmentManagerSelect({
  departmentId,
  currentManagerId,
  employees,
}: {
  departmentId: string;
  currentManagerId: string | null;
  employees: { id: string; full_name: string }[];
}) {
  const [state, formAction] = useActionState(
    (prevState: SetDepartmentManagerState, formData: FormData) =>
      setDepartmentManager(departmentId, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          name="employee_id"
          defaultValue={currentManagerId ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-control border border-border bg-surface px-[10px] py-[6px] text-[12.5px] text-ink outline-none focus:border-primary"
        >
          <option value="">No manager assigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <span className="text-[11px] font-bold text-bad">{state.error}</span>}
    </form>
  );
}
