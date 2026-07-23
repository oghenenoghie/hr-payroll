"use client";

import { useState } from "react";
import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createPayRun } from "./actions";

type Frequency = "weekly" | "biweekly" | "monthly" | "thirteenth_month" | "bonus";

export function PayRunForm({ employees }: { employees: { id: string; full_name: string }[] }) {
  const [state, formAction] = useActionState(createPayRun, null);
  const [frequency, setFrequency] = useState<Frequency>("monthly");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      {state?.missingTin && state.missingTin.length > 0 && (
        <div className="rounded-panel border border-bad bg-bad-tint px-3 py-2 text-[12.5px] font-bold text-bad">
          Missing TIN: {state.missingTin.join(", ")}
        </div>
      )}
      <FormField label="Period start" name="period_start" type="date" />
      <FormField label="Period end" name="period_end" type="date" />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="frequency">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="thirteenth_month">13th Month</option>
          <option value="bonus">Bonus</option>
        </select>
        {frequency === "thirteenth_month" && (
          <p className="text-[11.5px] text-ink-soft">
            13th Month pays each active employee one month&apos;s basic salary, taxed on top of what they&apos;ve
            already earned this year. It doesn&apos;t apply leave, attendance, overtime or loan deductions.
          </p>
        )}
        {frequency === "bonus" && (
          <p className="text-[11.5px] text-ink-soft">
            Bonus pays whatever discretionary amount you enter per employee below, taxed on top of what they&apos;ve
            already earned this year. Leave employees you&apos;re not paying at ₦0 — they&apos;re skipped entirely.
          </p>
        )}
      </div>

      {frequency === "bonus" && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Bonus amount per employee (₦)
          </span>
          {employees.length === 0 ? (
            <p className="text-[13px] text-ink-soft">No active employees.</p>
          ) : (
            <div className="flex flex-col gap-2 rounded-control border border-border p-3">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink">{employee.full_name}</span>
                  <input
                    type="number"
                    name={`bonus_amount_${employee.id}`}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-[140px] rounded-control border border-border bg-surface px-[10px] py-[7px] text-right text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SubmitButton>Run payroll</SubmitButton>
    </form>
  );
}
