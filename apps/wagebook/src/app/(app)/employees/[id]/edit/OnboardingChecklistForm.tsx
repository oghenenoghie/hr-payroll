"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { saveOnboardingChecklist, type SaveOnboardingChecklistState } from "./actions";

type Checklist = {
  documentation_collected: boolean;
  contract_signed: boolean;
} | null;

export function OnboardingChecklistForm({
  employeeId,
  checklist,
  hasDocuments,
}: {
  employeeId: string;
  checklist: Checklist;
  hasDocuments: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: SaveOnboardingChecklistState, formData: FormData) =>
      saveOnboardingChecklist(employeeId, prevState, formData),
    null,
  );

  const items: { key: keyof NonNullable<Checklist>; label: string }[] = [
    { key: "documentation_collected", label: "Documentation collected" },
    { key: "contract_signed", label: "Contract signed" },
  ];

  const doneCount = items.filter((item) => checklist?.[item.key]).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-ink-soft">
        Probation tracking and confirmation are handled by the probation fields above — this covers the two steps
        before that.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <FormError message={state?.error} />
        {items.map((item) => {
          const isDocumentation = item.key === "documentation_collected";
          const disabled = isDocumentation && !hasDocuments && !checklist?.[item.key];
          return (
            <div key={item.key} className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  name={item.key}
                  value="true"
                  defaultChecked={checklist?.[item.key] ?? false}
                  disabled={disabled}
                  className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {item.label}
              </label>
              {disabled && (
                <span className="pl-6 text-[12px] text-ink-soft">Upload a document above first.</span>
              )}
            </div>
          );
        })}
        <span className="text-[12px] text-ink-soft">{doneCount} of {items.length} steps done</span>
        <SubmitButton>Save checklist</SubmitButton>
      </form>
    </div>
  );
}
