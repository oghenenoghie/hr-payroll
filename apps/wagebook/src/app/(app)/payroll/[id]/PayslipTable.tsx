"use client";

import { Fragment, useState } from "react";
import { NG_2026_1, computeAnnualPaye } from "@plutus/compliance";
import type { Tables } from "@plutus/core";
import { formatKobo, formatPercent } from "@/lib/format";

type PayslipRow = Tables<"payslips"> & { employees: { full_name: string } | null };

const RULE_VERSIONS: Record<string, typeof NG_2026_1> = {
  [NG_2026_1.id]: NG_2026_1,
};

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export function PayslipTable({ payslips, ruleVersionId }: { payslips: PayslipRow[]; ruleVersionId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ruleVersion = RULE_VERSIONS[ruleVersionId];

  if (payslips.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
        No payslips for this run.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={`${thClass} text-left`}>Employee</th>
            <th className={`${thClass} text-right`}>Gross</th>
            <th className={`${thClass} text-right`}>Pension (8%)</th>
            <th className={`${thClass} text-right`}>NHF (2.5%)</th>
            <th className={`${thClass} text-right`}>PAYE</th>
            <th className={`${thClass} text-right`}>Net</th>
            <th className={thClass}></th>
          </tr>
        </thead>
        <tbody>
          {payslips.map((slip) => {
            const expanded = expandedId === slip.id;
            return (
              <Fragment key={slip.id}>
                <tr className="border-b border-border">
                  <td className={`${tdClass} font-bold text-ink`}>{slip.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(slip.gross_kobo))}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>
                    {formatKobo(BigInt(slip.pension_employee_kobo))}
                  </td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(slip.nhf_kobo))}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(slip.paye_kobo))}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(slip.net_kobo))}</td>
                  <td className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : slip.id)}
                      className="text-[12px] font-bold text-primary"
                    >
                      {expanded ? "hide" : "· how?"}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border bg-bg">
                    <td colSpan={7} className="px-3 py-4">
                      {ruleVersion ? (
                        <DerivationDetail slip={slip} ruleVersion={ruleVersion} />
                      ) : (
                        <p className="text-[12.5px] text-ink-soft">
                          Rule version {ruleVersionId} is not available for re-derivation in this build.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DerivationDetail({ slip, ruleVersion }: { slip: PayslipRow; ruleVersion: typeof NG_2026_1 }) {
  const bandResult = computeAnnualPaye(BigInt(slip.chargeable_income_kobo), ruleVersion);

  // employee_deductions_kobo is pension(EE) + NHF + PAYE plus any loan
  // repayment and benefit employee contribution applied on top — back the
  // loan portion out here (benefits has its own stored column) so the
  // derivation still reconciles to net pay instead of silently going
  // unaccounted for.
  const benefitEmployeeDeductionKobo = BigInt(slip.benefit_employee_deduction_kobo);
  const loanRepaymentKobo =
    BigInt(slip.employee_deductions_kobo) -
    BigInt(slip.pension_employee_kobo) -
    BigInt(slip.nhf_kobo) -
    BigInt(slip.paye_kobo) -
    benefitEmployeeDeductionKobo;

  const taxableReimbursementKobo = BigInt(slip.taxable_reimbursement_kobo);
  const nonTaxableReimbursementKobo = BigInt(slip.non_taxable_reimbursement_kobo);
  const unpaidLeaveDeductionKobo = BigInt(slip.unpaid_leave_deduction_kobo);
  const attendanceAbsenceDeductionKobo = BigInt(slip.attendance_absence_deduction_kobo);
  const benefitEmployerCostKobo = BigInt(slip.benefit_employer_cost_kobo);

  return (
    <div className="flex flex-col gap-4 text-[12.5px]">
      {(taxableReimbursementKobo > 0n ||
        nonTaxableReimbursementKobo > 0n ||
        unpaidLeaveDeductionKobo > 0n ||
        attendanceAbsenceDeductionKobo > 0n) && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Reimbursements, leave &amp; attendance adjustments
          </span>
          {taxableReimbursementKobo > 0n && (
            <Row label="Taxable expense reimbursement — added to chargeable income" value={`+ ${formatKobo(taxableReimbursementKobo)}`} />
          )}
          {nonTaxableReimbursementKobo > 0n && (
            <Row label="Non-taxable expense reimbursement — pure cash on top of gross" value={`+ ${formatKobo(nonTaxableReimbursementKobo)}`} />
          )}
          {unpaidLeaveDeductionKobo > 0n && (
            <Row label="Unpaid leave — reduces gross and chargeable income" value={`− ${formatKobo(unpaidLeaveDeductionKobo)}`} />
          )}
          {attendanceAbsenceDeductionKobo > 0n && (
            <Row
              label="Unrecorded absence (attendance grid) — reduces gross and chargeable income"
              value={`− ${formatKobo(attendanceAbsenceDeductionKobo)}`}
            />
          )}
        </div>
      )}

      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Statutory deductions
        </span>
        <Row
          label={`Pension employee (${formatPercent(ruleVersion.pension.employeeRateScaled)})`}
          value={`− ${formatKobo(BigInt(slip.pension_employee_kobo))}`}
        />
        <Row label={`NHF (${formatPercent(ruleVersion.nhf.rateScaled)})`} value={`− ${formatKobo(BigInt(slip.nhf_kobo))}`} />
        <Row label="Rent relief" value={`− ${formatKobo(BigInt(slip.rent_relief_kobo))}`} />
        <p className="mt-1 text-[11px] text-ink-soft">
          Pension employer share ({formatPercent(ruleVersion.pension.employerRateScaled)},{" "}
          {formatKobo(BigInt(slip.pension_employer_kobo))}) is an employer cost, not an employee deduction.
        </p>
      </div>

      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Cumulative chargeable income (year-to-date)
        </span>
        <Row label="Before this period" value={formatKobo(BigInt(slip.cumulative_chargeable_income_before_kobo))} />
        <Row label="After this period" value={formatKobo(BigInt(slip.chargeable_income_kobo))} emphasis />
      </div>

      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          PAYE — progressive bands on year-to-date position
        </span>
        {bandResult.bands
          .filter((band) => band.taxableInBandKobo > 0n)
          .map((band, i) => (
            <Row
              key={i}
              label={`${formatKobo(band.taxableInBandKobo)} @ ${formatPercent(band.rateScaled)}`}
              value={formatKobo(band.taxInBandKobo)}
            />
          ))}
        <Row
          label="Cumulative PAYE already withheld before this period"
          value={`− ${formatKobo(BigInt(slip.cumulative_paye_paid_before_kobo))}`}
        />
        <Row label="This period's PAYE" value={formatKobo(BigInt(slip.paye_kobo))} emphasis />
      </div>

      {loanRepaymentKobo > 0n && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Loan repayment (post-tax)
          </span>
          <Row label="Deducted this period" value={`− ${formatKobo(loanRepaymentKobo)}`} />
        </div>
      )}

      {(benefitEmployerCostKobo > 0n || benefitEmployeeDeductionKobo > 0n) && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Benefits
          </span>
          {benefitEmployeeDeductionKobo > 0n && (
            <Row label="Employee contribution (post-tax)" value={`− ${formatKobo(benefitEmployeeDeductionKobo)}`} />
          )}
          {benefitEmployerCostKobo > 0n && (
            <p className="mt-1 text-[11px] text-ink-soft">
              Employer cost this period ({formatKobo(benefitEmployerCostKobo)}) is a company cost, not an employee
              deduction.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-[6px] last:border-b-0">
      <span className={emphasis ? "font-bold text-ink" : "text-ink-soft"}>{label}</span>
      <span className={emphasis ? "font-extrabold text-ink" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}
