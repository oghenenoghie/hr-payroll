"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createPolicy } from "./actions";

export function PolicyForm() {
  const [state, formAction] = useActionState(createPolicy, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Policy published." : undefined} />
      <FormField label="Title" name="title" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          rows={8}
          required
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Publish policy</SubmitButton>
    </form>
  );
}
