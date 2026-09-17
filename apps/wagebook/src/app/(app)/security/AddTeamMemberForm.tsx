"use client";

import { useState } from "react";
import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { Button } from "@/components/Button";
import { addTeamMember, type AddTeamMemberState } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "payroll_manager", label: "Payroll Manager" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "auditor", label: "Auditor" },
  { value: "admin", label: "Super Admin" },
];

export function AddTeamMemberForm() {
  const [state, formAction] = useActionState<AddTeamMemberState, FormData>(addTeamMember, null);
  const [copied, setCopied] = useState(false);

  if (state && "success" in state) {
    const credentials = `Sign in with: ${state.email}\nPassword: ${state.password}`;

    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-panel border border-good bg-good-tint px-3 py-2 text-[12.5px] font-bold text-good">
          Account created. Copy these credentials and send them now — the password won&apos;t be shown again.
        </div>
        <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4 font-mono text-[13px] text-ink">
          <span>Sign in with: {state.email}</span>
          <span>Password: {state.password}</span>
        </div>
        <Button
          type="button"
          size="md"
          onClick={() => {
            navigator.clipboard.writeText(credentials);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy credentials"}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField label="Email" name="email" type="email" />
        </div>
        <div className="flex flex-col gap-2 sm:w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="payroll_manager"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}
