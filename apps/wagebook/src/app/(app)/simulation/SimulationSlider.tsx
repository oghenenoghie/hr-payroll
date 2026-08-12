"use client";

import { useActionState, useMemo, useState } from "react";
import { NG_2026_1, computeAnnualPaye, computePension, deriveChargeableIncome, computeNhf } from "@plutus/compliance";
import type { PayComponent } from "@plutus/compliance";
import { formatKobo } from "@/lib/format";
import { FormError, FormNotice } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { applyRaise } from "./actions";

interface EmployeeBase {
  id: string;
  basicKobo: number;
  housingKobo: number;
  transportKobo: number;
  annualRentKobo: number;
}

interface ScenarioTotals {
  grossKobo: bigint;
  payeKobo: bigint;
  employerPensionKobo: bigint;
}

function scenarioAt(employees: EmployeeBase[], multiplier: number): ScenarioTotals {
  let grossKobo = 0n;
  let payeKobo = 0n;
  let employerPensionKobo = 0n;

  for (const employee of employees) {
    const components: PayComponent[] = [
      { code: "basic", amountKobo: BigInt(Math.round(employee.basicKobo * multiplier)), kind: "regular" },
      { code: "housing", amountKobo: BigInt(Math.round(employee.housingKobo * multiplier)), kind: "regular" },
      { code: "transport", amountKobo: BigInt(Math.round(employee.transportKobo * multiplier)), kind: "regular" },
    ];
    const grossThisEmployee = components.reduce((sum, c) => sum + c.amountKobo, 0n);
    const pension = computePension(components, NG_2026_1);
    const nhfKobo = computeNhf(components, NG_2026_1);
    const chargeableIncomeKobo = deriveChargeableIncome(
      {
        annualGrossKobo: grossThisEmployee,
        pensionEmployeeKobo: pension.employeeKobo,
        nhfKobo,
        annualRentPaidKobo: BigInt(employee.annualRentKobo),
      },
      NG_2026_1,
    );
    const { annualPayeKobo } = computeAnnualPaye(chargeableIncomeKobo, NG_2026_1);

    grossKobo += grossThisEmployee;
    payeKobo += annualPayeKobo;
    employerPensionKobo += pension.employerKobo;
  }

  return { grossKobo, payeKobo, employerPensionKobo };
}

export function SimulationSlider({ employees, isAdmin }: { employees: EmployeeBase[]; isAdmin: boolean }) {
  const [raisePercent, setRaisePercent] = useState(0);
  const [applyState, applyFormAction, isApplying] = useActionState(applyRaise, null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const baseline = useMemo(() => scenarioAt(employees, 1), [employees]);
  const projected = useMemo(() => scenarioAt(employees, 1 + raisePercent / 100), [employees, raisePercent]);

  if (employees.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
        No active employees to simulate.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <label htmlFor="raise" className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Org-wide raise
          </label>
          <span className="text-[18px] font-extrabold text-primary">{raisePercent}%</span>
        </div>
        <input
          id="raise"
          type="range"
          min={0}
          max={50}
          step={1}
          value={raisePercent}
          onChange={(e) => setRaisePercent(Number(e.target.value))}
          className="mt-3 w-full accent-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <MetricCard
          label="Annual gross payroll"
          beforeKobo={baseline.grossKobo}
          afterKobo={projected.grossKobo}
        />
        <MetricCard label="Annual org PAYE" beforeKobo={baseline.payeKobo} afterKobo={projected.payeKobo} />
        <MetricCard
          label="Employer pension (10%)"
          beforeKobo={baseline.employerPensionKobo}
          afterKobo={projected.employerPensionKobo}
        />
      </div>

      {isAdmin && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Apply this raise</span>
          <p className="mt-2 text-[13px] text-ink-soft">
            Scales basic, housing and transport by {raisePercent}% for all {employees.length} active employees shown
            above — a real change to their contractual pay, logged to each employee&apos;s compensation history and
            notified to their own account. This is not a pay run: nothing is paid out until you create one.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPendingFormData(new FormData(event.currentTarget));
            }}
            className="mt-3 flex flex-col gap-3"
          >
            <FormError message={applyState?.error} />
            <FormNotice message={applyState?.success} />
            <input type="hidden" name="raisePercent" value={raisePercent} />
            <button
              type="submit"
              disabled={raisePercent === 0 || isApplying}
              className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isApplying ? "Working…" : `Apply ${raisePercent}% raise to ${employees.length} employees`}
            </button>
          </form>
        </div>
      )}

      {pendingFormData && (
        <ConfirmDialog
          title={`Apply this ${raisePercent}% raise?`}
          message={`Basic, housing and transport will be scaled up by ${raisePercent}% for all ${employees.length} active employees shown above — a real, immediate change to their contractual pay, logged to each employee's compensation history. Nothing is paid out until you create a pay run afterward.`}
          tone="primary"
          confirmLabel="Apply raise"
          onConfirm={() => {
            const formData = pendingFormData;
            setPendingFormData(null);
            applyFormAction(formData);
          }}
          onCancel={() => setPendingFormData(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, beforeKobo, afterKobo }: { label: string; beforeKobo: bigint; afterKobo: bigint }) {
  const deltaKobo = afterKobo - beforeKobo;
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-ink-soft">Before</span>
          <span className="text-[13px] font-bold text-ink">{formatKobo(beforeKobo)}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-[12px] text-ink-soft">After</span>
          <span className="text-[15px] font-extrabold text-ink">{formatKobo(afterKobo)}</span>
        </div>
        {deltaKobo > 0n && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-ink-soft">Δ</span>
            <span className="text-[12px] font-bold text-bad">+{formatKobo(deltaKobo)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
