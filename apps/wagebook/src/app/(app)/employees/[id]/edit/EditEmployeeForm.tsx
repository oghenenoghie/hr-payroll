"use client";

import { useActionState } from "react";
import { toNaira } from "@plutus/compliance";
import type { Tables } from "@plutus/core";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { formatKobo } from "@/lib/format";
import { editEmployee, type EditEmployeeState } from "./actions";

type JobGrade = { id: string; name: string; min_annual_kobo: number; max_annual_kobo: number };
type Manager = { id: string; full_name: string };

export function EditEmployeeForm({
  employee,
  departments,
  branches,
  jobGrades,
  managers,
  canEditSalary,
  canControlMasking,
}: {
  employee: Tables<"employees_masked">;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  jobGrades: JobGrade[];
  managers: Manager[];
  canEditSalary: boolean;
  canControlMasking: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: EditEmployeeState, formData: FormData) => editEmployee(employee.id!, prevState, formData),
    null,
  );

  const assignedGrade = jobGrades.find((grade) => grade.id === employee.job_grade_id);
  const annualTotalKobo =
    canEditSalary && employee.basic_kobo !== null && employee.housing_kobo !== null && employee.transport_kobo !== null
      ? BigInt(employee.basic_kobo) + BigInt(employee.housing_kobo) + BigInt(employee.transport_kobo)
      : null;
  const bandStatus =
    assignedGrade && annualTotalKobo !== null
      ? annualTotalKobo < BigInt(assignedGrade.min_annual_kobo)
        ? "below"
        : annualTotalKobo > BigInt(assignedGrade.max_annual_kobo)
          ? "above"
          : "within"
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Full name" name="full_name" defaultValue={employee.full_name ?? ""} />
      <FormField
        label="State of residence"
        name="state_of_residence"
        required={false}
        defaultValue={employee.state_of_residence ?? ""}
      />
      <FormField label="Hire date" name="hire_date" type="date" required={false} defaultValue={employee.hire_date ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Probation end date"
          name="probation_end_date"
          type="date"
          required={false}
          defaultValue={employee.probation_end_date ?? ""}
        />
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Probation</label>
          <label className="flex h-[43px] items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="confirmed" value="true" defaultChecked={employee.confirmed ?? false} className="h-4 w-4" />
            Confirmed (passed probation)
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="employment_type">
            Employment type
          </label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={employee.employment_type ?? "permanent"}
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <FormField
          label="Contract end date"
          name="contract_end_date"
          type="date"
          required={false}
          defaultValue={employee.contract_end_date ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Date of birth"
          name="date_of_birth"
          type="date"
          required={false}
          defaultValue={employee.date_of_birth ?? ""}
        />
        <FormField label="Nationality" name="nationality" required={false} defaultValue={employee.nationality ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="department_id">
          Department
        </label>
        <select
          id="department_id"
          name="department_id"
          defaultValue={employee.department_id ?? ""}
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
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="branch_id">
          Branch
        </label>
        <select
          id="branch_id"
          name="branch_id"
          defaultValue={employee.branch_id ?? ""}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="">No branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
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
          defaultValue={employee.job_grade_id ?? ""}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="">No job grade</option>
          {jobGrades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name} ({formatKobo(BigInt(grade.min_annual_kobo))} – {formatKobo(BigInt(grade.max_annual_kobo))})
            </option>
          ))}
        </select>
        {bandStatus === "below" && (
          <p className="text-[12px] font-bold text-warn">
            Below this grade&apos;s band (min {formatKobo(BigInt(assignedGrade!.min_annual_kobo))}/yr).
          </p>
        )}
        {bandStatus === "above" && (
          <p className="text-[12px] font-bold text-warn">
            Above this grade&apos;s band (max {formatKobo(BigInt(assignedGrade!.max_annual_kobo))}/yr).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="manager_id">
          Manager
        </label>
        <select
          id="manager_id"
          name="manager_id"
          defaultValue={employee.manager_id ?? ""}
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

      {canEditSalary ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              label="Basic (₦/yr)"
              name="basic"
              type="number"
              required={false}
              defaultValue={String(toNaira(BigInt(employee.basic_kobo!)))}
            />
            <FormField
              label="Housing (₦/yr)"
              name="housing"
              type="number"
              required={false}
              defaultValue={String(toNaira(BigInt(employee.housing_kobo!)))}
            />
            <FormField
              label="Transport (₦/yr)"
              name="transport"
              type="number"
              required={false}
              defaultValue={String(toNaira(BigInt(employee.transport_kobo!)))}
            />
          </div>
          <FormField
            label="Annual rent paid (₦)"
            name="annual_rent"
            type="number"
            required={false}
            defaultValue={String(toNaira(BigInt(employee.annual_rent_kobo!)))}
          />
        </>
      ) : (
        <p className="rounded-panel border border-border bg-bg px-4 py-3 text-[12.5px] text-ink-soft">
          Compensation is restricted from HR Manager view for this employee. Contact an admin or payroll manager
          to make changes.
        </p>
      )}

      <FormField label="TIN" name="tin" required={false} defaultValue={employee.tin ?? ""} />
      <FormField label="PFA" name="pfa" required={false} defaultValue={employee.pfa ?? ""} />

      {canEditSalary && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bank name" name="bank_name" required={false} defaultValue={employee.bank_name ?? ""} />
            <FormField
              label="Bank account number (NUBAN)"
              name="bank_account_number"
              required={false}
              defaultValue={employee.bank_account_number ?? ""}
            />
          </div>
          <FormField
            label="Bank account name"
            name="bank_account_name"
            required={false}
            defaultValue={employee.bank_account_name ?? ""}
          />
        </>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={employee.status ?? "active"}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {canControlMasking && (
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            name="salary_masked"
            value="true"
            defaultChecked={employee.salary_masked ?? false}
            className="h-4 w-4"
          />
          Mask compensation from HR Manager view
        </label>
      )}

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
