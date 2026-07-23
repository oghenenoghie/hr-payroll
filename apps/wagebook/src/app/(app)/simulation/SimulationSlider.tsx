"use client";

import { useMemo, useState } from "react";
import { NG_2026_1, computeAnnualPaye, computePension, deriveChargeableIncome, computeNhf } from "@plutus/compliance";
import type { PayComponent } from "@plutus/compliance";
import { formatKobo } from "@/lib/format";

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

export function SimulationSlider({ employees }: { employees: EmployeeBase[] }) {
  const [raisePercent, setRaisePercent] = useState(0);

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
