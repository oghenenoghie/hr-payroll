"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { addStatementLine } from "./actions";

export function StatementLineForm({ reconciliationId }: { reconciliationId: string }) {
  const [state, formAction] = useActionState(addStatementLine, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="reconciliation_id" value={reconciliationId} />
      <FormError message={state?.error} />
      <FormField label="Description" name="description" />
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Date" name="line_date" type="date" />
        <FormField label="Amount (₦)" name="amount" type="number" />
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue="withdrawal"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
        </div>
      </div>
      <SubmitButton>Add statement line</SubmitButton>
    </form>
  );
}
