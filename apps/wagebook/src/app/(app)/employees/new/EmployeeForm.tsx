"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { addEmployee } from "./actions";

export function EmployeeForm() {
  const [state, formAction] = useActionState(addEmployee, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Full name" name="full_name" />
      <FormField label="Email" name="email" type="email" required={false} />
      <FormField label="State of residence" name="state_of_residence" required={false} />
      <FormField label="Hire date" name="hire_date" type="date" required={false} />
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Basic (₦/yr)" name="basic" type="number" required={false} defaultValue="0" />
        <FormField label="Housing (₦/yr)" name="housing" type="number" required={false} defaultValue="0" />
        <FormField label="Transport (₦/yr)" name="transport" type="number" required={false} defaultValue="0" />
      </div>
      <FormField label="Annual rent paid (₦)" name="annual_rent" type="number" required={false} defaultValue="0" />
      <FormField label="TIN" name="tin" required={false} />
      <FormField label="PFA" name="pfa" required={false} />
      <SubmitButton>Add employee</SubmitButton>
    </form>
  );
}
