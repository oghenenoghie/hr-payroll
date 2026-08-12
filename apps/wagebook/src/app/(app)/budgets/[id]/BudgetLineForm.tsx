"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { upsertBudgetLine } from "./actions";

type Account = { code: string; name: string; type: string };

export function BudgetLineForm({
  budgetId,
  accounts,
  periodStart,
  periodEnd,
}: {
  budgetId: string;
  accounts: Account[];
  periodStart: string;
  periodEnd: string;
}) {
  const [state, formAction] = useActionState(upsertBudgetLine, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="budget_id" value={budgetId} />
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="account_code">
            Account
          </label>
          <select
            id="account_code"
            name="account_code"
            defaultValue=""
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="" disabled>
              Choose an account
            </option>
            {accounts.map((account) => (
              <option key={account.code} value={account.code}>
                {account.name} ({account.type})
              </option>
            ))}
          </select>
        </div>
        <FormField label="Budgeted amount (₦)" name="amount" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Line period start" name="period_start" type="date" defaultValue={periodStart} />
        <FormField label="Line period end" name="period_end" type="date" defaultValue={periodEnd} />
      </div>
      <p className="text-[12px] text-ink-soft">
        Defaults to the budget&apos;s whole period. Narrow it (e.g. one calendar month) and add another line for the
        next month to break an account into a monthly or quarterly plan.
      </p>
      <SubmitButton>Save line</SubmitButton>
    </form>
  );
}
