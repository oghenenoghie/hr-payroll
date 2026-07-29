"use client";

import { useActionState, useState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { BankNameField } from "@/components/BankNameField";
import { formatKobo } from "@/lib/format";
import { addEmployee } from "./actions";

type JobGrade = { id: string; name: string; min_annual_kobo: number; max_annual_kobo: number };

type Manager = { id: string; full_name: string };

const initialValues = {
  full_name: "",
  email: "",
  employee_id: "",
  state_of_residence: "",
  hire_date: "",
  probation_end_date: "",
  employment_type: "permanent",
  contract_end_date: "",
  date_of_birth: "",
  nationality: "",
  department_id: "",
  branch_id: "",
  job_grade_id: "",
  manager_id: "",
  basic: "0",
  housing: "0",
  transport: "0",
  annual_rent: "0",
  tin: "",
  pfa: "",
  bank_account_number: "",
  bank_account_name: "",
};

type Values = typeof initialValues;

export function EmployeeForm({
  departments,
  branches,
  jobGrades,
  managers,
}: {
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  jobGrades: JobGrade[];
  managers: Manager[];
}) {
  const [state, formAction] = useActionState(addEmployee, null);
  // Controlled, not defaultValue: React resets uncontrolled fields once a
  // form action settles, success or error alike — on a form this long, an
  // error on one field would otherwise wipe every other field already
  // filled in.
  const [values, setValues] = useState<Values>(initialValues);

  const set =
    (field: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormField label="Full name" name="full_name" value={values.full_name} onChange={set("full_name")} />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Email"
          name="email"
          type="email"
          required={false}
          value={values.email}
          onChange={set("email")}
        />
        <FormField
          label="Employee ID"
          name="employee_id"
          required={false}
          value={values.employee_id}
          onChange={set("employee_id")}
        />
      </div>
      <FormField
        label="State of residence"
        name="state_of_residence"
        required={false}
        value={values.state_of_residence}
        onChange={set("state_of_residence")}
      />
      <FormField
        label="Hire date"
        name="hire_date"
        type="date"
        required={false}
        value={values.hire_date}
        onChange={set("hire_date")}
      />
      <FormField
        label="Probation end date"
        name="probation_end_date"
        type="date"
        required={false}
        value={values.probation_end_date}
        onChange={set("probation_end_date")}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="employment_type">
            Employment type
          </label>
          <select
            id="employment_type"
            name="employment_type"
            value={values.employment_type}
            onChange={set("employment_type")}
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
          value={values.contract_end_date}
          onChange={set("contract_end_date")}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Date of birth"
          name="date_of_birth"
          type="date"
          required={false}
          value={values.date_of_birth}
          onChange={set("date_of_birth")}
        />
        <FormField
          label="Nationality"
          name="nationality"
          required={false}
          value={values.nationality}
          onChange={set("nationality")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="department_id">
          Department
        </label>
        <select
          id="department_id"
          name="department_id"
          value={values.department_id}
          onChange={set("department_id")}
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
          value={values.branch_id}
          onChange={set("branch_id")}
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
          value={values.job_grade_id}
          onChange={set("job_grade_id")}
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
          value={values.manager_id}
          onChange={set("manager_id")}
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
        <FormField
          label="Basic (₦/yr)"
          name="basic"
          type="number"
          required={false}
          value={values.basic}
          onChange={set("basic")}
        />
        <FormField
          label="Housing (₦/yr)"
          name="housing"
          type="number"
          required={false}
          value={values.housing}
          onChange={set("housing")}
        />
        <FormField
          label="Transport (₦/yr)"
          name="transport"
          type="number"
          required={false}
          value={values.transport}
          onChange={set("transport")}
        />
      </div>
      <FormField
        label="Annual rent paid (₦)"
        name="annual_rent"
        type="number"
        required={false}
        value={values.annual_rent}
        onChange={set("annual_rent")}
      />
      <FormField label="TIN" name="tin" required={false} value={values.tin} onChange={set("tin")} />
      <FormField label="PFA" name="pfa" required={false} value={values.pfa} onChange={set("pfa")} />
      <div className="grid grid-cols-2 gap-4">
        <BankNameField defaultValue="" />
        <FormField
          label="Bank account number (NUBAN)"
          name="bank_account_number"
          required={false}
          value={values.bank_account_number}
          onChange={set("bank_account_number")}
        />
      </div>
      <FormField
        label="Bank account name"
        name="bank_account_name"
        required={false}
        value={values.bank_account_name}
        onChange={set("bank_account_name")}
      />
      <SubmitButton>Add employee</SubmitButton>
    </form>
  );
}
