"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { saveOffboardingChecklist, type SaveOffboardingChecklistState } from "./actions";

type Checklist = {
  notice_period_served: boolean;
  assets_returned: boolean;
  clearance_obtained: boolean;
  experience_letter_issued: boolean;
} | null;

export function OffboardingChecklistForm({
  employeeId,
  checklist,
  accessRevoked,
  settlementProcessed,
}: {
  employeeId: string;
  checklist: Checklist;
  accessRevoked: boolean;
  settlementProcessed: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: SaveOffboardingChecklistState, formData: FormData) =>
      saveOffboardingChecklist(employeeId, prevState, formData),
    null,
  );

  const items: { key: keyof NonNullable<Checklist>; label: string }[] = [
    { key: "notice_period_served", label: "Notice period served" },
    { key: "assets_returned", label: "Company assets returned" },
    { key: "clearance_obtained", label: "Clearance obtained" },
    { key: "experience_letter_issued", label: "Experience letter issued" },
  ];

  const doneCount = items.filter((item) => checklist?.[item.key]).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Access revoked</span>
          <span className="font-bold text-good">{accessRevoked ? "Yes" : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Final settlement</span>
          <span className={`font-bold ${settlementProcessed ? "text-good" : "text-warn"}`}>
            {settlementProcessed ? "Processed" : "Not yet processed"}
          </span>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-3">
        <FormError message={state?.error} />
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              name={item.key}
              value="true"
              defaultChecked={checklist?.[item.key] ?? false}
              className="h-4 w-4"
            />
            {item.label}
          </label>
        ))}
        <span className="text-[12px] text-ink-soft">{doneCount} of {items.length} steps done</span>
        <SubmitButton>Save checklist</SubmitButton>
      </form>
    </div>
  );
}
