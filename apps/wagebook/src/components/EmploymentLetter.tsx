import { formatKobo } from "@/lib/format";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  permanent: "a permanent",
  contract: "a fixed-term contract",
  intern: "an internship",
};

function formatLongDate(date: string): string {
  return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
}

export function EmploymentLetter({
  orgName,
  fullName,
  hireDate,
  employmentType,
  contractEndDate,
  jobGradeName,
  departmentName,
  managerName,
  probationEndDate,
  confirmed,
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
  managerName: string | null;
  probationEndDate: string | null;
  confirmed: boolean;
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

      <h1 className="text-[18px] font-extrabold text-ink">Confirmation of Employment</h1>

      <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-ink">
        <p>Dear {fullName},</p>
        <p>
          We are pleased to confirm your engagement with {orgName} on {EMPLOYMENT_TYPE_LABEL[employmentType] ?? "an"}{" "}
          basis
          {jobGradeName ? ` as ${jobGradeName}` : ""}
          {departmentName ? ` in the ${departmentName} department` : ""}
          {hireDate ? `, effective ${formatLongDate(hireDate)}` : ""}.
          {employmentType === "contract" && contractEndDate
            ? ` This engagement runs through ${formatLongDate(contractEndDate)}, subject to any renewal agreed between both parties before that date.`
            : ""}
        </p>
        {!confirmed && probationEndDate && (
          <p>
            Your appointment is subject to a probationary period ending {formatLongDate(probationEndDate)}, during
            which either party may end the engagement in line with company policy. Confirmation follows successful
            completion of this period.
          </p>
        )}
        {confirmed && (
          <p>Your appointment has been confirmed following successful completion of your probationary period.</p>
        )}
        {managerName && <p>You will report to {managerName}.</p>}
      </div>

      <div className="rounded-panel border border-border bg-bg p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Annual remuneration breakdown
        </span>
        {annualTotalKobo !== null ? (
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <Row label="Basic" amountKobo={basicKobo!} />
            <Row label="Housing" amountKobo={housingKobo!} />
            <Row label="Transport" amountKobo={transportKobo!} />
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-extrabold text-ink">
              <span>Annual total</span>
              <span>{formatKobo(BigInt(annualTotalKobo))}</span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-soft">
            Salary figures are restricted from this view. Ask an admin or payroll manager to generate this letter.
          </p>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-ink">
        We look forward to your continued contribution to {orgName}.
      </p>

      <div className="mt-4 flex flex-col gap-1 text-[13px] text-ink">
        <span>For {orgName},</span>
        <span className="mt-8 border-t border-border pt-1 text-[12px] text-ink-soft">Authorized signatory</span>
      </div>

      <p className="text-[11px] text-ink-soft">
        This letter is generated directly from {orgName}&apos;s records and reflects the employee&apos;s details on
        file as of the issue date above.
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
