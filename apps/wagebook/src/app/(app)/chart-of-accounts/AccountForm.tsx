"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createAccount } from "./actions";

const TYPE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

export function AccountForm() {
  const [state, formAction] = useActionState(createAccount, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Account added." : undefined} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Code" name="code" />
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue="expense"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormField label="Name" name="name" />
      <FormField label="Description" name="description" required={false} />
      <SubmitButton>Add account</SubmitButton>
    </form>
  );
}
