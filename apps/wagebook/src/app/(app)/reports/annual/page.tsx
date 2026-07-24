import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function AnnualTaxReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
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

  const currentYear = new Date().getUTCFullYear();
  const { year: yearParam } = await searchParams;
  const year = yearParam && !Number.isNaN(Number(yearParam)) ? Number(yearParam) : currentYear;

  const { data: payRuns } = await supabase
    .from("pay_runs")
    .select("id")
    .neq("status", "reversed")
    .gte("period_start", `${year}-01-01`)
    .lte("period_start", `${year}-12-31`);

  const payRunIds = (payRuns ?? []).map((run) => run.id);

  const { data: payslips } =
    payRunIds.length > 0
      ? await supabase
          .from("payslips")
          .select("employee_id, gross_kobo, paye_kobo, pension_employee_kobo, nhf_kobo, rent_relief_kobo, employees(full_name, tin)")
          .in("pay_run_id", payRunIds)
      : { data: [] };

  const totalsByEmployee = new Map<
    string,
    { fullName: string; tin: string | null; grossKobo: bigint; payeKobo: bigint; pensionKobo: bigint; nhfKobo: bigint; rentReliefKobo: bigint }
  >();

  for (const slip of payslips ?? []) {
    const running = totalsByEmployee.get(slip.employee_id) ?? {
      fullName: slip.employees?.full_name ?? "—",
      tin: slip.employees?.tin ?? null,
      grossKobo: 0n,
      payeKobo: 0n,
      pensionKobo: 0n,
      nhfKobo: 0n,
      rentReliefKobo: 0n,
    };
    running.grossKobo += BigInt(slip.gross_kobo);
    running.payeKobo += BigInt(slip.paye_kobo);
    running.pensionKobo += BigInt(slip.pension_employee_kobo);
    running.nhfKobo += BigInt(slip.nhf_kobo);
    running.rentReliefKobo += BigInt(slip.rent_relief_kobo);
    totalsByEmployee.set(slip.employee_id, running);
  }

  const rows = [...totalsByEmployee.entries()].sort((a, b) => a[1].fullName.localeCompare(b[1].fullName));

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Reports</span>
          <h1 className="text-[22px] font-extrabold text-ink">Annual tax reconciliation</h1>
          <p className="text-[13px] text-ink-soft">
            Each employee&apos;s total gross pay and statutory deductions for {year}, aggregated across every pay run
            that year regardless of frequency. Reversed runs are excluded. Generate a printable certificate per
            employee from this data — direct e-filing to NRS/state IRS isn&apos;t built yet.
          </p>
          <Link href="/reports" className="mt-1 text-[12.5px] font-bold text-primary">
            ← Back to Reports
          </Link>
        </div>
        <form className="flex items-end gap-2" action="/reports/annual">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="year">
              Tax year
            </label>
            <select
              id="year"
              name="year"
              defaultValue={String(year)}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
          >
            Go
          </button>
        </form>
      </header>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          {rows.length} employee{rows.length === 1 ? "" : "s"} with pay in {year}
        </span>
        <a
          href={`/reports/annual/export?year=${year}`}
          className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Employee</th>
              <th className={`${thClass} text-left`}>TIN</th>
              <th className={`${thClass} text-right`}>Gross pay</th>
              <th className={`${thClass} text-right`}>PAYE</th>
              <th className={`${thClass} text-right`}>Pension (employee)</th>
              <th className={`${thClass} text-right`}>NHF</th>
              <th className={`${thClass} text-right`}>Rent relief claimed</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map(([employeeId, totals]) => (
                <tr key={employeeId} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{totals.fullName}</td>
                  <td className={`${tdClass} text-ink-soft`}>{totals.tin ?? "—"}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(totals.grossKobo)}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(totals.payeKobo)}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(totals.pensionKobo)}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(totals.nhfKobo)}</td>
                  <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(totals.rentReliefKobo)}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/employees/${employeeId}/tax-certificate?year=${year}`} className="font-bold text-primary">
                      Certificate
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No pay runs in {year}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
