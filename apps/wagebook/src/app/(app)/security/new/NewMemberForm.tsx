"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createTeamMember, type CreateTeamMemberState } from "./actions";

type UnlinkedEmployee = { id: string; full_name: string; email: string | null; employee_id: string | null };
type Role = { key: string; label: string };

export function NewMemberForm({
  unlinkedEmployees,
  roles,
}: {
  unlinkedEmployees: UnlinkedEmployee[];
  roles: Role[];
}) {
  const [state, formAction] = useActionState<CreateTeamMemberState, FormData>(createTeamMember, null);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState(roles.find((r) => r.key === "employee")?.key ?? roles[0]?.key ?? "employee");
  const [employeeId, setEmployeeId] = useState(unlinkedEmployees[0]?.id ?? "");

  if (state && "success" in state) {
    const credentials = `Sign in with: ${state.loginIdentifier}\nPassword: ${state.password}`;

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-panel border border-good bg-good-tint px-3 py-2 text-[12.5px] font-bold text-good">
          Account created for {state.fullName}. Copy these credentials and send them now — the password won&apos;t
          be shown again.
        </div>
        <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4 font-mono text-[13px] text-ink">
          <span>Sign in with: {state.loginIdentifier}</span>
          <span>Password: {state.password}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(credentials);
            setCopied(true);
          }}
          className="w-fit rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
        >
          {copied ? "Copied" : "Copy credentials"}
        </button>
        <Link href="/security" className="w-fit text-[13px] font-bold text-primary">
          ← Back to Security &amp; Access
        </Link>
      </div>
    );
  }

  const selectedEmployee = unlinkedEmployees.find((employee) => employee.id === employeeId);

  return (
    <form action={formAction} className="flex max-w-[420px] flex-col gap-4">
      <FormError message={state?.error} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="role">
          Role
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          {roles.map((option) => (
            <option key={option.key} value={option.key}>
              {option.key === "employee" ? "Staff (Employee)" : option.label}
            </option>
          ))}
        </select>
      </div>

      {role === "employee" ? (
        unlinkedEmployees.length === 0 ? (
          <p className="text-[13px] text-ink-soft">
            Every employee record already has a linked account.{" "}
            <Link href="/employees/new" className="font-bold text-primary">
              Add a new employee
            </Link>{" "}
            first, then come back here.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="employee_id">
                Employee
              </label>
              <select
                id="employee_id"
                name="employee_id"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
              >
                {unlinkedEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </div>
            {selectedEmployee && !selectedEmployee.email && !selectedEmployee.employee_id && (
              <p className="text-[12px] text-ink-soft">
                This employee has no email or Employee ID on file yet — enter at least one so they have a way to
                sign in.
              </p>
            )}
            {selectedEmployee && !selectedEmployee.email && <FormField label="Email" name="email" type="email" required={false} />}
            {selectedEmployee && !selectedEmployee.employee_id && (
              <FormField label="Employee ID" name="staff_employee_id" type="text" required={false} />
            )}
          </>
        )
      ) : (
        <>
          <FormField label="Full name" name="full_name" type="text" />
          <FormField label="Email" name="email" type="email" />
        </>
      )}

      {(role !== "employee" || unlinkedEmployees.length > 0) && <SubmitButton>Create account</SubmitButton>}
    </form>
  );
}
