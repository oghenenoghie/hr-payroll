"use client";

import { useMemo, useState } from "react";
import { NG_2026_1, computeAnnualPaye, deriveDemoPaye, naira, solveDemoGrossForNet } from "@plutus/compliance";
import { formatKobo, formatPercent } from "@/lib/format";

const inputBase =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";

const microLabel = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-6 ${className}`}>{children}</div>
  );
}

function StepRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-[10px] last:border-b-0">
      <span className={emphasis ? "text-[13px] font-bold text-ink" : "text-[13px] text-ink-soft"}>{label}</span>
      <span className={emphasis ? "text-[14px] font-extrabold text-ink" : "text-[13px] font-bold text-ink"}>
        {value}
      </span>
    </div>
  );
}

export function PayeCalculator() {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [grossInput, setGrossInput] = useState("5000000");
  const [netInput, setNetInput] = useState("4000000");
  const [rentInput, setRentInput] = useState("1200000");

  const grossUp = useMemo(() => {
    if (mode !== "net") return null;
    const net = Number(netInput);
    const rent = Number(rentInput);
    if (!Number.isFinite(net) || net <= 0) return null;
    try {
      return solveDemoGrossForNet(naira(net), naira(Number.isFinite(rent) && rent >= 0 ? rent : 0), NG_2026_1);
    } catch {
      return null;
    }
  }, [mode, netInput, rentInput]);

  const derivation = useMemo(() => {
    const rent = Number(rentInput);
    const rentKobo = naira(Number.isFinite(rent) && rent >= 0 ? rent : 0);

    if (mode === "net") {
      return grossUp?.derivation ?? null;
    }

    const gross = Number(grossInput);
    if (!Number.isFinite(gross) || gross <= 0) return null;
    return deriveDemoPaye(naira(gross), rentKobo, NG_2026_1);
  }, [mode, grossInput, rentInput, grossUp]);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className={microLabel}>Plutus Technologies · {NG_2026_1.id}</span>
        <h1 className="text-[22px] font-extrabold text-ink">PAYE Calculator</h1>
        <p className="text-[13px] text-ink-soft">
          Every figure shown step by step, the way the compliance engine derives it.
        </p>
      </header>

      <div className="rounded-panel border border-warn bg-warn-tint px-4 py-3 text-[12.5px] font-bold text-warn">
        The 50/30/20 basic/housing/transport split below is a demo assumption for this standalone
        calculator. Production reads each employee&apos;s actual pay components — never a derived
        percentage of gross.
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[320px_1fr]">
        <Card className="flex flex-col gap-4 h-fit">
          <div className="flex rounded-control border border-border p-1">
            {(["gross", "net"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`flex-1 rounded-control px-3 py-[7px] text-[12px] font-bold ${
                  mode === option ? "bg-primary text-white" : "text-ink-soft"
                }`}
              >
                {option === "gross" ? "I know my gross" : "I know my net (gross-up)"}
              </button>
            ))}
          </div>

          {mode === "gross" ? (
            <div className="flex flex-col gap-2">
              <label className={microLabel} htmlFor="gross">
                Annual gross (₦)
              </label>
              <input
                id="gross"
                inputMode="numeric"
                className={inputBase}
                value={grossInput}
                onChange={(e) => setGrossInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className={microLabel} htmlFor="net">
                Target annual net / take-home (₦)
              </label>
              <input
                id="net"
                inputMode="numeric"
                className={inputBase}
                value={netInput}
                onChange={(e) => setNetInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <p className="text-[11px] text-ink-soft">
                Solves for the gross the employer must pay so this employee actually takes home this
                much — the arrangement common in senior/expatriate contracts where the employer bears
                the tax.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className={microLabel} htmlFor="rent">
              Annual rent paid (₦)
            </label>
            <input
              id="rent"
              inputMode="numeric"
              className={inputBase}
              value={rentInput}
              onChange={(e) => setRentInput(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          {mode === "net" && grossUp && (
            <div className="flex flex-col gap-1 rounded-control bg-bg px-3 py-[10px]">
              <span className={microLabel}>Solved annual gross</span>
              <span className="text-[15px] font-extrabold text-ink">{formatKobo(grossUp.annualGrossKobo)}</span>
            </div>
          )}

          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-4">
            <span className={microLabel}>Rule version</span>
            <span className="text-[13px] font-bold text-ink">{NG_2026_1.id}</span>
            <span className="text-[11.5px] text-ink-soft">
              Effective {NG_2026_1.effectiveFrom} · Nigeria Tax Act 2025
            </span>
          </div>
        </Card>

        {derivation ? (
          <div className="flex flex-col gap-5">
            <Card>
              <span className={microLabel}>Step 1 · Pay components (demo split)</span>
              <div className="mt-3">
                {derivation.payComponents.map((component) => (
                  <StepRow
                    key={component.code}
                    label={component.code[0]!.toUpperCase() + component.code.slice(1)}
                    value={formatKobo(component.amountKobo)}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <span className={microLabel}>Step 2 · Statutory deductions before PAYE</span>
              <div className="mt-3">
                <StepRow
                  label={`Pension (employee) — ${formatPercent(NG_2026_1.pension.employeeRateScaled)} of pensionable pay`}
                  value={`− ${formatKobo(derivation.pensionEmployeeKobo)}`}
                />
                <StepRow
                  label={`NHF — ${formatPercent(NG_2026_1.nhf.rateScaled)} of basic`}
                  value={`− ${formatKobo(derivation.nhfKobo)}`}
                />
                <StepRow
                  label="Rent relief (20% of rent, capped at ₦500,000)"
                  value={`− ${formatKobo(derivation.rentReliefKobo)}`}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                Pension employer share (
                {formatPercent(NG_2026_1.pension.employerRateScaled)}, {formatKobo(derivation.pensionEmployerKobo)}) is
                an employer cost — never an employee deduction, and not part of this total.
              </p>
            </Card>

            <Card>
              <span className={microLabel}>Step 3 · Chargeable income</span>
              <div className="mt-3">
                <StepRow label="Annual chargeable income" value={formatKobo(derivation.chargeableIncomeKobo)} emphasis />
              </div>
            </Card>

            <Card>
              <span className={microLabel}>Step 4 · PAYE — progressive bands</span>
              <div className="mt-3">
                {computeBandRows(derivation.chargeableIncomeKobo)}
              </div>
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                <StepRow label="Annual PAYE" value={formatKobo(derivation.annualPayeKobo)} emphasis />
                <StepRow label="Monthly PAYE" value={formatKobo(derivation.monthlyPayeKobo)} emphasis />
              </div>
            </Card>

            <Card>
              <span className={microLabel}>Step 5 · Net pay</span>
              <div className="mt-3">
                <StepRow
                  label="Annual net"
                  value={formatKobo(
                    derivation.annualGrossKobo -
                      derivation.pensionEmployeeKobo -
                      derivation.nhfKobo -
                      derivation.annualPayeKobo,
                  )}
                  emphasis
                />
                <StepRow
                  label="Monthly net"
                  value={formatKobo(
                    (derivation.annualGrossKobo -
                      derivation.pensionEmployeeKobo -
                      derivation.nhfKobo -
                      derivation.annualPayeKobo) /
                      12n,
                  )}
                  emphasis
                />
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <span className="text-[13px] text-ink-soft">
              {mode === "gross"
                ? "Enter an annual gross above zero to see the derivation."
                : "Enter a target annual net above zero to solve for the required gross."}
            </span>
          </Card>
        )}
      </div>
    </div>
  );
}

function computeBandRows(chargeableIncomeKobo: bigint) {
  const result = computeAnnualPaye(chargeableIncomeKobo, NG_2026_1);
  return result.bands
    .filter((band) => band.taxableInBandKobo > 0n)
    .map((band, i) => (
      <StepRow
        key={i}
        label={`${formatKobo(band.taxableInBandKobo)} @ ${formatPercent(band.rateScaled)}`}
        value={formatKobo(band.taxInBandKobo)}
      />
    ));
}
