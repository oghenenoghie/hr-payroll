import { formatKobo } from "@/lib/format";

export function AnnualTaxCertificate({
  orgName,
  fullName,
  tin,
  year,
  grossKobo,
  payeKobo,
  pensionKobo,
  nhfKobo,
  rentReliefKobo,
  netKobo,
}: {
  orgName: string;
  fullName: string;
  tin: string | null;
  year: number;
  grossKobo: bigint;
  payeKobo: bigint;
  pensionKobo: bigint;
  nhfKobo: bigint;
  rentReliefKobo: bigint;
  netKobo: bigint;
}) {
  const issuedOn = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 rounded-card border border-border bg-surface p-10 print:border-none print:p-0">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <span className="text-[15px] font-extrabold text-ink">{orgName}</span>
        <span className="text-[12px] text-ink-soft">Issued {issuedOn}</span>
      </header>

      <h1 className="text-[18px] font-extrabold text-ink">Annual Tax Certificate — {year}</h1>

      <p className="text-[13px] leading-relaxed text-ink">
        This certifies the total pay and statutory deductions for <span className="font-bold">{fullName}</span>
        {tin ? ` (TIN ${tin})` : ""} at {orgName} for the {year} tax year, aggregated across every pay run that
        year, excluding any reversed run.
      </p>

      <div className="rounded-panel border border-border bg-bg p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Annual summary</span>
        <div className="mt-3 flex flex-col gap-2 text-[13px]">
          <Row label="Gross pay" amountKobo={grossKobo} />
          <Row label="Pension (employee)" amountKobo={-pensionKobo} />
          <Row label="NHF" amountKobo={-nhfKobo} />
          <Row label="Rent relief claimed" amountKobo={rentReliefKobo} />
          <Row label="PAYE" amountKobo={-payeKobo} />
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-extrabold text-ink">
            <span>Net pay for the year</span>
            <span>{formatKobo(netKobo)}</span>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-ink-soft">
        This certificate is generated directly from {orgName}&apos;s payroll records. It is not a substitute for a
        Nigeria Revenue Service annual return or e-filed submission.
      </p>
    </div>
  );
}

function Row({ label, amountKobo }: { label: string; amountKobo: bigint }) {
  const negative = amountKobo < 0n;
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={negative ? "font-bold text-bad" : "font-bold text-ink"}>
        {negative ? "-" : ""}
        {formatKobo(negative ? -amountKobo : amountKobo)}
      </span>
    </div>
  );
}
