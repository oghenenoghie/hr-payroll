"use client";

import { useActionState } from "react";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { updateMemberRole, type UpdateRoleState } from "./actions";

type Role = { key: string; label: string };

export function MemberRoleForm({
  userId,
  currentRole,
  roles,
}: {
  userId: string;
  currentRole: string;
  roles: Role[];
}) {
  const [state, formAction] = useActionState<UpdateRoleState, FormData>(
    (prevState, formData) => updateMemberRole(userId, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex items-center justify-end gap-2">
      {state?.error && <span className="text-[11px] font-bold text-bad">{state.error}</span>}
      <select
        name="role"
        defaultValue={currentRole}
        className="rounded-control border border-border bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-primary"
      >
        {roles.map((role) => (
          <option key={role.key} value={role.key}>
            {role.label}
          </option>
        ))}
      </select>
      <FormSubmitButton className="text-[12px] font-bold text-primary">Save</FormSubmitButton>
    </form>
  );
}
