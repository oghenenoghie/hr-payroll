"use client";

import { useActionState } from "react";
import { toNaira } from "@plutus/compliance";
import type { Tables } from "@plutus/core";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { editEmployee, type EditEmployeeState } from "./actions";

export function EditEmployeeForm({
  employee,
  canEditSalary,
  canControlMasking,
}: {
  employee: Tables<"employees_masked">;
  canEditSalary: boolean;
  canControlMasking: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: EditEmployeeState, formData: FormData) => editEmployee(employee.id!, prevState, formData),
    null,
  );

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
