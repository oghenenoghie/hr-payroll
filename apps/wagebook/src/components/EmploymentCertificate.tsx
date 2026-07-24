import { formatKobo } from "@/lib/format";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  intern: "Intern",
};

export function EmploymentCertificate({
  orgName,
  fullName,
  hireDate,
  employmentType,
  status,
  jobGradeName,
  departmentName,
  basicKobo,
  housingKobo,
  transportKobo,
}: {
  orgName: string;
  fullName: string;
  hireDate: string | null;
  employmentType: string;
  status: string;
  jobGradeName: string | null;
  departmentName: string | null;
  basicKobo: number | null;
  housingKobo: number | null;
  transportKobo: number | null;
}) {
  const issuedOn = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
  const annualTotalKobo =
    basicKobo !== null && housingKobo !== null && transportKobo !== null ? basicKobo + housingKobo + transportKobo : null;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 rounded-card border border-border bg-surface p-10 print:border-none print:p-0">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <span className="text-[15px] font-extrabold text-ink">{orgName}</span>
        <span className="text-[12px] text-ink-soft">Issued {issuedOn}</span>
      </header>

      <h1 className="text-[18px] font-extrabold text-ink">Employment &amp; Salary Certificate</h1>

      <p className="text-[13px] leading-relaxed text-ink">
        This is to certify that <span className="font-bold">{fullName}</span> is{" "}
        {status === "active" ? "currently employed by" : "was employed by"} {orgName} as a{" "}
        {EMPLOYMENT_TYPE_LABEL[employmentType] ?? employmentType} staff member
        {jobGradeName ? ` on the ${jobGradeName} job grade` : ""}
        {departmentName ? ` in the ${departmentName} department` : ""}
        {hireDate ? `, since ${new Date(hireDate).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}` : ""}
        .
      </p>

      <div className="rounded-panel border border-border bg-bg p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Annual salary breakdown</span>
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
            Salary figures are restricted from this view. Ask an admin or payroll manager to generate this certificate.
          </p>
        )}
      </div>

      <p className="text-[12px] text-ink-soft">
        This certificate is generated directly from {orgName}&apos;s payroll records and reflects the employee&apos;s
        current compensation on file as of the issue date above.
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
