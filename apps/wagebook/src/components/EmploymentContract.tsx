import { formatKobo } from "@/lib/format";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  permanent: "Permanent",
  contract: "Fixed-term contract",
  intern: "Internship",
};

function formatLongDate(date: string): string {
  return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
}

const clauseHeading = "text-[13px] font-extrabold text-ink";
const clauseBody = "mt-1 text-[13px] leading-relaxed text-ink";

// Standard, generic contract terms drawn from records on file — not
// lawyer-reviewed language for a specific jurisdictionally-binding
// agreement. Termination notice deliberately doesn't invent a specific
// number of weeks/months: that's a company-policy and Nigerian Labour Act
// question this build doesn't have a data field for, so the clause below
// points at both rather than guessing a figure.
export function EmploymentContract({
  orgName,
  fullName,
  hireDate,
  employmentType,
  contractEndDate,
  jobGradeName,
  departmentName,
  probationEndDate,
  confirmed,
  annualLeaveBalanceDays,
  basicKobo,
  housingKobo,
  transportKobo,
}: {
  orgName: string;
  fullName: string;
  hireDate: string | null;
  employmentType: string;
  contractEndDate: string | null;
  jobGradeName: string | null;
  departmentName: string | null;
  probationEndDate: string | null;
  confirmed: boolean;
  annualLeaveBalanceDays: number;
  basicKobo: number | null;
  housingKobo: number | null;
  transportKobo: number | null;
}) {
  const issuedOn = formatLongDate(new Date().toISOString());
  const annualTotalKobo =
    basicKobo !== null && housingKobo !== null && transportKobo !== null ? basicKobo + housingKobo + transportKobo : null;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 rounded-card border border-border bg-surface p-10 print:border-none print:p-0">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <span className="text-[15px] font-extrabold text-ink">{orgName}</span>
        <span className="text-[12px] text-ink-soft">{issuedOn}</span>
      </header>

      <h1 className="text-[18px] font-extrabold text-ink">Contract of Employment</h1>
      <p className="text-[13px] leading-relaxed text-ink">
        This agreement is between <span className="font-bold">{orgName}</span> (&quot;the Employer&quot;) and{" "}
        <span className="font-bold">{fullName}</span> (&quot;the Employee&quot;).
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <span className={clauseHeading}>1. Position and Duties</span>
          <p className={clauseBody}>
            The Employee is engaged as {jobGradeName ?? "a staff member"}
            {departmentName ? ` in the ${departmentName} department` : ""}, on a{" "}
            {EMPLOYMENT_TYPE_LABEL[employmentType]?.toLowerCase() ?? employmentType} basis.
          </p>
        </div>

        <div>
          <span className={clauseHeading}>2. Commencement</span>
          <p className={clauseBody}>
            This engagement {hireDate ? `commenced on ${formatLongDate(hireDate)}` : "has no recorded start date"}.
            {employmentType === "contract" && contractEndDate
              ? ` It runs through ${formatLongDate(contractEndDate)}, subject to any renewal agreed in writing between both parties before that date.`
              : ""}
          </p>
        </div>

        <div>
          <span className={clauseHeading}>3. Probation</span>
          <p className={clauseBody}>
            {confirmed
              ? "The Employee has successfully completed the probationary period and been confirmed."
              : probationEndDate
                ? `The Employee's appointment is subject to a probationary period ending ${formatLongDate(probationEndDate)}. Either party may end the engagement during this period in line with company policy.`
                : "No probationary period is currently on file for this appointment."}
          </p>
        </div>

        <div>
          <span className={clauseHeading}>4. Remuneration</span>
          {annualTotalKobo !== null ? (
            <div className="mt-2 flex flex-col gap-2 rounded-panel border border-border bg-bg p-4 text-[13px]">
              <Row label="Basic" amountKobo={basicKobo!} />
              <Row label="Housing" amountKobo={housingKobo!} />
              <Row label="Transport" amountKobo={transportKobo!} />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-extrabold text-ink">
                <span>Annual total</span>
                <span>{formatKobo(BigInt(annualTotalKobo))}</span>
              </div>
            </div>
          ) : (
            <p className={clauseBody}>
              Salary figures are restricted from this view. Ask an admin or payroll manager to generate this
              contract.
            </p>
          )}
          <p className={clauseBody}>
            Remuneration is paid in arrears through the Employer&apos;s standard payroll cycle, subject to statutory
            deductions (including PAYE, pension and NHF as applicable) and any lawful deductions on record.
          </p>
        </div>

        <div>
          <span className={clauseHeading}>5. Leave</span>
          <p className={clauseBody}>
            The Employee is entitled to annual leave in accordance with the Employer&apos;s leave policy, currently
            standing at {annualLeaveBalanceDays} day{annualLeaveBalanceDays === 1 ? "" : "s"} on record.
          </p>
        </div>

        <div>
          <span className={clauseHeading}>6. Termination</span>
          <p className={clauseBody}>
            Either party may terminate this engagement by providing notice in accordance with the Nigerian Labour Act
            and the Employer&apos;s internal policies, or payment in lieu thereof where applicable.
          </p>
        </div>

        <div>
          <span className={clauseHeading}>7. Governing Law</span>
          <p className={clauseBody}>This agreement is governed by the laws of the Federal Republic of Nigeria.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 text-[13px] text-ink">
        <div className="flex flex-col gap-1">
          <span className="border-t border-border pt-1 text-[12px] text-ink-soft">For the Employer</span>
          <span className="mt-6 text-[11px] text-ink-soft">Signature &amp; date</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="border-t border-border pt-1 text-[12px] text-ink-soft">{fullName}</span>
          <span className="mt-6 text-[11px] text-ink-soft">Signature &amp; date</span>
        </div>
      </div>

      <p className="text-[11px] text-ink-soft">
        This document reflects standard terms drawn from {orgName}&apos;s records on file and does not constitute
        legal advice. Review with qualified counsel before relying on it as a binding agreement.
      </p>
    </div>
  );
}

function Row({ label, amountKobo }: { label: string; amountKobo: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-bold text-ink">{formatKobo(BigInt(amountKobo))}</span>
    </div>
  );
}
