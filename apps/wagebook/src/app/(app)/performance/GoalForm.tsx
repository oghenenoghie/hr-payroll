"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import type { FormState } from "./actions";

export function GoalForm({
  action,
  cycles,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  cycles: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Goal saved." : undefined} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="cycle_id">
          Review cycle
        </label>
        <select
          id="cycle_id"
          name="cycle_id"
          required
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          {cycles.length === 0 && <option value="">No review cycles yet</option>}
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name}
            </option>
          ))}
        </select>
      </div>
      <FormField label="Goal title" name="title" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <FormField label="Target date" name="target_date" type="date" required={false} />
      <SubmitButton>Add goal</SubmitButton>
    </form>
  );
}
