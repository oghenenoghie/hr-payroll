"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { reversePayRun } from "./actions";

export function ReversalForm({ payRunId }: { payRunId: string }) {
  const [state, formAction] = useActionState(reversePayRun.bind(null, payRunId), null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <p className="text-[13px] text-ink-soft">
        Posts a correcting journal entry that exactly reverses this run&apos;s ledger impact — the original postings
        and payslips are never edited. This does not restore loan balances or revert expense/leave/attendance/overtime
        approvals this run consumed, and it does not address amounts already remitted to a tax or pension authority.
      </p>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="reason">
          Reason (required)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={2}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>
      <SubmitButton>Reverse pay run</SubmitButton>
    </form>
  );
}
