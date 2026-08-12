"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { useToast } from "@/components/Toast";
import { runItfAssessment, type RunItfAssessmentState } from "./actions";

const inputClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function ItfAssessmentForm({
  defaultYear,
  minEmployees,
  minAnnualTurnoverLabel,
}: {
  defaultYear: number;
  minEmployees: number;
  minAnnualTurnoverLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<RunItfAssessmentState, FormData>(runItfAssessment, null);
  const { showToast } = useToast();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      showToast("ITF assessment recorded", "good");
    }
    wasPending.current = isPending;
  }, [isPending, state, showToast]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:w-[140px]">
          <label className={labelClass} htmlFor="assessment_year">
            Year
          </label>
          <input
            id="assessment_year"
            name="assessment_year"
            type="number"
            min="2000"
            defaultValue={defaultYear}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-1">
          <label className={labelClass} htmlFor="annual_turnover_naira">
            {defaultYear}&apos;s annual turnover (₦)
          </label>
          <input
            id="annual_turnover_naira"
            name="annual_turnover_naira"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 75000000"
            className={inputClass}
          />
        </div>
        <SubmitButton>Run assessment</SubmitButton>
      </div>
      <p className="text-[12px] text-ink-soft">
        Computes the ITF rate on this year&apos;s posted gross payroll if your organization qualifies ({minEmployees}
        + active employees or the turnover above at/over {minAnnualTurnoverLabel}), and posts it to the ledger. Each
        year can only be assessed once.
      </p>
    </form>
  );
}
