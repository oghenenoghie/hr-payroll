"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { Badge } from "@/components/Badge";
import { setModuleVisibility, type SetModuleVisibilityState } from "./actions";

export function ModuleVisibilityRow({
  moduleKey,
  moduleName,
  roles,
  assignedRoleKeys,
}: {
  moduleKey: string;
  moduleName: string;
  roles: { key: string; label: string }[];
  assignedRoleKeys: string[];
}) {
  const [state, formAction] = useActionState<SetModuleVisibilityState, FormData>(
    (prevState, formData) => setModuleVisibility(moduleKey, prevState, formData),
    null,
  );
  // Controlled, not defaultChecked: a form action resets uncontrolled
  // fields once it settles, success or error alike, which would silently
  // discard whatever the admin had just toggled if the save failed.
  const [checked, setChecked] = useState<Set<string>>(new Set(assignedRoleKeys));
  const isRestricted = assignedRoleKeys.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-extrabold text-ink">{moduleName}</span>
        {isRestricted ? <Badge tone="warn">Restricted</Badge> : <Badge tone="neutral">Visible to everyone</Badge>}
      </div>
      <FormError message={state?.error} />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {roles.map((role) => {
          const isChecked = checked.has(role.key);
          return (
            <label key={role.key} className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                name={role.key}
                checked={isChecked}
                onChange={(event) => {
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) {
                      next.add(role.key);
                    } else {
                      next.delete(role.key);
                    }
                    return next;
                  });
                }}
                className="h-4 w-4 accent-primary"
              />
              {role.label}
            </label>
          );
        })}
      </div>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
