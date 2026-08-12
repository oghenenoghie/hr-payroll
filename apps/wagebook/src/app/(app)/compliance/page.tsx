import { redirect } from "next/navigation";
import { NG_2026_1 } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo, formatPercent } from "@/lib/format";
import { Badge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PrintButton } from "@/components/PrintButton";
import { ItfAssessmentForm } from "./ItfAssessmentForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const rv = NG_2026_1;

// "Applied" schemes are wired into real pay-run, vendor-bill, or (for
// ITF) assessment postings; "documented" schemes have a versioned,
// tested calculator in packages/compliance but nothing in the product
// yet produces the data they need — so we show the real rule, never a
// live number we can't back. ITF flips from documented to applied the
// moment this org has run at least one assessment (see
// ItfAssessmentForm below) — before that, nothing has actually computed
// a real figure for it yet, same reasoning as every other row here.
function buildSchemes(itfApplied: boolean): {
  name: string;
  base: string;
  rate: string;
  borneBy: string;
  authority: string;
  deadline: string;
  status: "applied" | "documented";
  appliedLabel?: string;
}[] {
  return [
    {
      name: "PAYE",
      base: "Annual chargeable income (cumulative)",
      rate: "0–25% progressive",
      borneBy: "Employee (withheld)",
      authority: "State IRS (residence) / NRS",
      deadline: `${rv.paye.remittance.dueDayOfFollowingMonth}th of the following month`,
      status: "applied",
    },
    {
      name: "Pension",
      base: "Basic + housing + transport",
      rate: `${formatPercent(rv.pension.employeeRateScaled)} EE / ${formatPercent(rv.pension.employerRateScaled)} ER (min)`,
      borneBy: "Both",
      authority: "Employee's PFA (→ PenCom)",
      deadline: `Within ${rv.pension.remittance.dueWorkingDaysAfterPayment} working days of payment`,
      status: "applied",
    },
    {
      name: "NHF",
      base: "Basic salary",
      rate: formatPercent(rv.nhf.rateScaled),
      borneBy: "Employee",
      authority: "FMBN",
      deadline: `Within ${rv.nhf.remittance.dueMonthsAfterPayment} month of payment`,
      status: "applied",
    },
    {
      name: "NSITF",
      base: "Total monthly payroll (excl. bonuses/overtime/13th month)",
      rate: formatPercent(rv.nsitf.rateScaled),
      borneBy: "Employer",
      authority: "NSITF",
      deadline: `Before the ${rv.nsitf.remittance.dueDayOfFollowingMonth}th of the following month`,
      status: "applied",
    },
    {
      name: "ITF",
      base: "Annual payroll",
      rate: `${formatPercent(rv.itf.rateScaled)} (qualifying employers)`,
      borneBy: "Employer",
      authority: "ITF",
      deadline: `On/before ${rv.itf.remittance.dueAnnuallyOn} annually`,
      status: itfApplied ? "applied" : "documented",
      appliedLabel: itfApplied ? "Applied via annual assessment" : undefined,
    },
    {
      name: "WHT (contractors)",
      base: "Contractor / vendor payment",
      rate: Object.entries(rv.wht.ratesScaledByCategory)
        .map(([category, rate]) => `${category.replace(/_/g, " ")} ${formatPercent(rate)}`)
        .join(" · "),
      borneBy: "Contractor (withheld)",
      authority: "NRS / State IRS",
      deadline: `By the ${rv.wht.remittance.dueDayOfFollowingMonth}st of the following month`,
      status: "applied",
      appliedLabel: "Applied in vendor bills",
    },
    {
      name: "VAT (vendor bills)",
      base: "VAT-exclusive bill subtotal",
      rate: `${formatPercent(rv.vat.standardRateScaled)} standard · 0% exempt by category`,
      borneBy: "Vendor charges buyer (output tax)",
      authority: rv.vat.remittance.authority,
      deadline: `By the ${rv.vat.remittance.dueDayOfFollowingMonth}st of the following month (provisional — confirm)`,
      status: "applied",
      appliedLabel: "Applied in vendor bills",
    },
    {
      name: "NHIS / NHIA",
      base: "Per applicable scheme",
      rate: "Scheme-defined",
      borneBy: "Both",
      authority: "Applicable health scheme",
      deadline: "Per scheme",
      status: "documented",
    },
  ];
}

export default async function CompliancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const canRunItfAssessment =
    membership?.role === "admin" || membership?.role === "payroll_manager" || membership?.role === "finance_manager";

  const [{ data: employees }, { data: itfAssessments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, state_of_residence, tin, status")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("itf_assessments")
      .select("assessment_year, annual_payroll_base_kobo, employee_count, annual_turnover_kobo, qualifies, employer_kobo, journal_entry_id")
      .eq("org_id", membership?.orgId ?? "")
      .order("assessment_year", { ascending: false }),
  ]);

  const missingTin = (employees ?? []).filter((e) => !e.tin);

  const missingTinCsv = toCsv(
    ["Employee", "State of Residence"],
    missingTin.map((e) => [e.full_name, e.state_of_residence ?? ""]),
  );

  const schemes = buildSchemes((itfAssessments ?? []).length > 0);
  const currentYear = new Date().getFullYear();
  const alreadyAssessedThisYear = (itfAssessments ?? []).some((a) => a.assessment_year === currentYear);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10 print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Compliance Engine</span>
          <span className="print:hidden">
            <PrintButton>Print / Save as PDF</PrintButton>
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">
          PAYE, pension, NHF, NHIS, NSITF, ITF, WHT &amp; VAT — versioned and current
        </h1>
        <p className="text-[13px] text-ink-soft">
          Rule version {rv.id}, effective {rv.effectiveFrom}. Every figure below is read live from this rule set —
          nothing here is hardcoded into calculation logic.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Scheme</th>
              <th className={`${thClass} text-left`}>Base</th>
              <th className={`${thClass} text-left`}>Rate</th>
              <th className={`${thClass} text-left`}>Borne by</th>
              <th className={`${thClass} text-left`}>Authority</th>
              <th className={`${thClass} text-left`}>Deadline</th>
              <th className={`${thClass} text-left`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((scheme) => (
              <tr key={scheme.name} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} font-bold text-ink`}>{scheme.name}</td>
                <td className={`${tdClass} text-ink-soft`}>{scheme.base}</td>
                <td className={`${tdClass} text-ink-soft`}>{scheme.rate}</td>
                <td className={`${tdClass} text-ink-soft`}>{scheme.borneBy}</td>
                <td className={`${tdClass} text-ink-soft`}>{scheme.authority}</td>
                <td className={`${tdClass} text-ink-soft`}>{scheme.deadline}</td>
                <td className={tdClass}>
                  {scheme.status === "applied" ? (
                    <Badge tone="good">{scheme.appliedLabel ?? "Applied in pay runs"}</Badge>
                  ) : (
                    <Badge tone="neutral">Documented — not yet applied</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 pt-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">PAYE bands</span>
        <p className="text-[12.5px] text-ink-soft">
          Marginal rates on annual chargeable income. Tax-free threshold {formatKobo(rv.paye.taxFreeThresholdKobo)}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Up to</th>
              <th className={`${thClass} text-right`}>Marginal rate</th>
            </tr>
          </thead>
          <tbody>
            {rv.paye.bands.map((band, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} text-ink`}>{band.upToKobo === null ? "No upper bound" : formatKobo(band.upToKobo)}</td>
                <td className={`${tdClass} text-right font-bold text-ink`}>{formatPercent(band.rateScaled)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 pt-2 print:hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">ITF annual assessment</span>
        <p className="text-[12.5px] text-ink-soft">
          Computes {formatPercent(rv.itf.rateScaled)} of the year&apos;s posted gross payroll for qualifying
          employers ({rv.itf.qualifyingThreshold.minEmployees}+ active employees or turnover at/over{" "}
          {formatKobo(rv.itf.qualifyingThreshold.minAnnualTurnoverKobo)}), and posts it to the ledger — never a
          number shown here without a real assessment behind it.
        </p>

        {canRunItfAssessment && !alreadyAssessedThisYear && (
          <ItfAssessmentForm
            defaultYear={currentYear}
            minEmployees={rv.itf.qualifyingThreshold.minEmployees}
            minAnnualTurnoverLabel={formatKobo(rv.itf.qualifyingThreshold.minAnnualTurnoverKobo)}
          />
        )}
        {canRunItfAssessment && alreadyAssessedThisYear && (
          <p className="text-[12.5px] font-bold text-good">{currentYear} has already been assessed — see below.</p>
        )}

        {(itfAssessments ?? []).length > 0 && (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Year</th>
                  <th className={`${thClass} text-right`}>Annual payroll base</th>
                  <th className={`${thClass} text-center`}>Employees</th>
                  <th className={`${thClass} text-right`}>Turnover</th>
                  <th className={`${thClass} text-center`}>Qualifies</th>
                  <th className={`${thClass} text-right`}>ITF liability</th>
                </tr>
              </thead>
              <tbody>
                {(itfAssessments ?? []).map((a) => (
                  <tr key={a.assessment_year} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{a.assessment_year}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(a.annual_payroll_base_kobo))}</td>
                    <td className={`${tdClass} text-center text-ink-soft`}>{a.employee_count}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(a.annual_turnover_kobo))}</td>
                    <td className={tdClass}>
                      <div className="flex justify-center">
                        <Badge tone={a.qualifies ? "good" : "neutral"}>{a.qualifies ? "Yes" : "No"}</Badge>
                      </div>
                    </td>
                    <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(BigInt(a.employer_kobo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            TIN registration gate
          </span>
          <div className="flex items-center gap-2">
            {missingTin.length > 0 && (
              <span className="print:hidden">
                <ExportCsvButton csv={missingTinCsv} filename="missing-tin.csv" />
              </span>
            )}
            {missingTin.length > 0 ? (
              <Badge tone="bad">{missingTin.length} missing TIN</Badge>
            ) : (
              <Badge tone="good">All active employees registered</Badge>
            )}
          </div>
        </div>
        <p className="text-[12.5px] text-ink-soft">
          Every active employee must hold a valid TIN before payroll can run. This list is what blocks the next run
          — resolve it before creating one.
        </p>

        {missingTin.length > 0 && (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-left`}>State of residence</th>
                </tr>
              </thead>
              <tbody>
                {missingTin.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{e.full_name}</td>
                    <td className={`${tdClass} text-ink-soft`}>{e.state_of_residence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
