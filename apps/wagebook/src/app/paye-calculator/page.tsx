"use client";

import { useMemo, useState } from "react";
import {
  calculateChargeableIncome,
  calculateNhf,
  calculatePaye,
  calculatePension,
  calculateRentRelief,
  koboToNaira,
  nairaToKobo,
  NG_2026_1,
  sum,
  type Kobo,
} from "@plutus/compliance";

function naira(kobo: Kobo): string {
  return `₦${Math.round(koboToNaira(kobo)).toLocaleString("en-NG")}`;
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label-micro block mb-1.5">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      />
      {hint ? <span className="block mt-1 text-xs text-[var(--ink-soft)]">{hint}</span> : null}
    </label>
  );
}

function DerivationRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "soft" | "strong";
}) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-[var(--border)] last:border-b-0">
      <span
        className={
          tone === "soft"
            ? "text-xs text-[var(--ink-soft)]"
            : "text-sm text-[var(--ink)]"
        }
      >
        {label}
      </span>
      <span
        className={
          tone === "strong"
            ? "text-lg font-extrabold text-[var(--ink)]"
            : tone === "soft"
              ? "text-xs text-[var(--ink-soft)]"
              : "text-sm font-bold text-[var(--ink)]"
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function PayeCalculatorPage() {
  const [monthlyBasic, setMonthlyBasic] = useState(300_000);
  const [monthlyHousing, setMonthlyHousing] = useState(150_000);
  const [monthlyTransport, setMonthlyTransport] = useState(50_000);
  const [annualRent, setAnnualRent] = useState(1_200_000);
  const [tin, setTin] = useState("");

  const rules = NG_2026_1;

  const result = useMemo(() => {
    const annualComponents = {
      basic: nairaToKobo(monthlyBasic * 12),
      housing: nairaToKobo(monthlyHousing * 12),
      transport: nairaToKobo(monthlyTransport * 12),
    };

    const gross = sum([annualComponents.basic, annualComponents.housing, annualComponents.transport]);
    const pension = calculatePension(annualComponents, rules.pension);
    const nhf = calculateNhf(annualComponents, rules.nhf);
    const rentRelief = calculateRentRelief(nairaToKobo(annualRent), rules.paye.rentRelief);
    const chargeableIncome = calculateChargeableIncome({
      gross,
      pensionEmployee: pension.employee,
      nhf,
      rentRelief,
    });
    const annualPaye = calculatePaye(chargeableIncome, rules.paye.bands);
    const monthlyPaye = annualPaye / 12n;
    const monthlyGross = gross / 12n;
    const monthlyDeductions = pension.employee / 12n + nhf / 12n + monthlyPaye;
    const monthlyNet = monthlyGross - monthlyDeductions;

    return { gross, pension, nhf, rentRelief, chargeableIncome, annualPaye, monthlyPaye, monthlyGross, monthlyNet };
  }, [monthlyBasic, monthlyHousing, monthlyTransport, annualRent, rules]);

  const tinMissing = tin.trim() === "";

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <p className="label-micro mb-2">{rules.id} · Nigeria Tax Act 2025</p>
        <h1 className="text-2xl font-extrabold mb-1">PAYE Calculator</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-8">
          Cumulative-annual PAYE, computed on chargeable income after pension, NHF
          and rent relief — every rate and band pulled from the versioned rule
          set, never hard-coded.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="card">
            <p className="label-micro mb-4">Monthly pay components</p>
            <div className="space-y-4">
              <NumberField label="Basic salary" value={monthlyBasic} onChange={setMonthlyBasic} />
              <NumberField label="Housing allowance" value={monthlyHousing} onChange={setMonthlyHousing} />
              <NumberField label="Transport allowance" value={monthlyTransport} onChange={setMonthlyTransport} />
              <NumberField
                label="Annual rent paid"
                value={annualRent}
                onChange={setAnnualRent}
                hint="Used for rent relief: 20% of annual rent, capped at ₦500,000."
              />
              <label className="block">
                <span className="label-micro block mb-1.5">Tax Identification Number</span>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="Required by law before a run"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </label>
              {tinMissing ? (
                <div className="rounded-lg bg-[var(--warn-tint)] text-[var(--warn)] text-xs font-bold px-3 py-2">
                  No TIN on file — this employee would block a payroll run, flagged
                  before processing, not after.
                </div>
              ) : (
                <div className="rounded-lg bg-[var(--good-tint)] text-[var(--good)] text-xs font-bold px-3 py-2">
                  TIN on file — eligible to run.
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <p className="label-micro mb-4">Derivation trail (annual)</p>
            <DerivationRow label="Gross" value={naira(result.gross)} />
            <DerivationRow label="Pensionable (basic + housing + transport)" value={naira(result.pension.pensionable)} tone="soft" />
            <DerivationRow label="Pension — employee (8%)" value={`− ${naira(result.pension.employee)}`} />
            <DerivationRow label="Pension — employer (10%, not a deduction)" value={naira(result.pension.employer)} tone="soft" />
            <DerivationRow label="NHF (2.5% of basic)" value={`− ${naira(result.nhf)}`} />
            <DerivationRow label="Rent relief" value={`− ${naira(result.rentRelief)}`} />
            <DerivationRow label="Chargeable income" value={naira(result.chargeableIncome)} />
            <DerivationRow label="PAYE (annual)" value={naira(result.annualPaye)} />

            <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-1">
              <DerivationRow label="PAYE this month" value={naira(result.monthlyPaye)} tone="strong" />
              <DerivationRow label="Net pay this month" value={naira(result.monthlyNet)} tone="strong" />
            </div>
          </section>
        </div>

        <p className="text-xs text-[var(--ink-soft)] mt-6">
          Illustrative calculation only — not tax or legal advice. Figures are
          versioned to {rules.id} and must be verified against current primary
          sources before production use.
        </p>
      </div>
    </main>
  );
}
