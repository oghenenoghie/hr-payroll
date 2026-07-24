"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { editPolicy, type EditPolicyState } from "./actions";

export function EditPolicyForm({ policy }: { policy: { id: string; title: string; content: string } }) {
  const [state, formAction] = useActionState(
    (prevState: EditPolicyState, formData: FormData) => editPolicy(policy.id, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormField label="Title" name="title" defaultValue={policy.title} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          rows={10}
          required
          defaultValue={policy.content}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <p className="text-[12px] text-ink-soft">
        Saving marks every existing acknowledgement as stale — employees will be asked to re-acknowledge.
      </p>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
