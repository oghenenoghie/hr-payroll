"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { inviteTeamMember, type InviteTeamMemberState } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "payroll_manager", label: "Payroll Manager" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "auditor", label: "Auditor" },
  { value: "admin", label: "Super Admin" },
];

export function InviteTeamMemberForm() {
  const [state, formAction] = useActionState<InviteTeamMemberState, FormData>(inviteTeamMember, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Invite sent." : undefined} />
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
        <SubmitButton>Send invite</SubmitButton>
      </div>
    </form>
  );
}
