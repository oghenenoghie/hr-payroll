"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { Badge } from "@/components/Badge";
import { setWidgetVisibility, type SetWidgetVisibilityState } from "./actions";

export function WidgetVisibilityRow({
  widgetKey,
  widgetLabel,
  widgetDescription,
  defaultRoleKeys,
  roles,
  assignedRoleKeys,
}: {
  widgetKey: string;
  widgetLabel: string;
  widgetDescription: string;
  defaultRoleKeys: string[];
  roles: { key: string; label: string }[];
  assignedRoleKeys: string[] | null;
}) {
  const [state, formAction] = useActionState<SetWidgetVisibilityState, FormData>(
    (prevState, formData) => setWidgetVisibility(widgetKey, prevState, formData),
    null,
  );
  const isCustomized = assignedRoleKeys !== null;
  // Controlled, not defaultChecked: a form action resets uncontrolled
  // fields once it settles, success or error alike, which would silently
  // discard whatever the admin had just toggled if the save failed.
  const [checked, setChecked] = useState<Set<string>>(new Set(assignedRoleKeys ?? defaultRoleKeys));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-extrabold text-ink">{widgetLabel}</span>
        {isCustomized ? <Badge tone="warn">Customized</Badge> : <Badge tone="neutral">Default roles</Badge>}
      </div>
      <p className="text-[12.5px] text-ink-soft">{widgetDescription}</p>
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
