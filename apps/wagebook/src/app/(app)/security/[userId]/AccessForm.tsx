"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { Badge } from "@/components/Badge";
import { ALL_SECTIONS, SECTION_LABELS, type SectionKey } from "@/lib/nav-sections";
import { updateNavAccess, type UpdateNavAccessState } from "./actions";

export function AccessForm({
  userId,
  effectiveSections,
  roleDefaults,
}: {
  userId: string;
  effectiveSections: SectionKey[];
  roleDefaults: SectionKey[];
}) {
  const [state, formAction] = useActionState<UpdateNavAccessState, FormData>(
    (prevState, formData) => updateNavAccess(userId, prevState, formData),
    null,
  );
  // Controlled, not defaultChecked: a form action resets uncontrolled
  // fields once it settles, success or error alike, which would silently
  // discard whatever the admin had just toggled if the save failed.
  const [checked, setChecked] = useState<Set<SectionKey>>(new Set(effectiveSections));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      {ALL_SECTIONS.map((section) => {
        const isChecked = checked.has(section);
        const isOverridden = roleDefaults.includes(section) !== isChecked;
        return (
          <label
            key={section}
            className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-ink">{SECTION_LABELS[section]}</span>
              {isOverridden && <Badge tone="warn">Overridden</Badge>}
            </div>
            <input
              type="checkbox"
              name={section}
              checked={isChecked}
              onChange={(event) => {
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (event.target.checked) {
                    next.add(section);
                  } else {
                    next.delete(section);
                  }
                  return next;
                });
              }}
              className="h-5 w-5 accent-primary"
            />
          </label>
        );
      })}
      <SubmitButton>Save access</SubmitButton>
    </form>
  );
}
