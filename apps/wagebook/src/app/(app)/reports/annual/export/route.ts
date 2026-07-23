import { NextResponse } from "next/server";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

// Same reconciliation math as /reports/annual — a bookkeeper's export of
// what a per-employee annual tax certificate would be built from. Not a
// certificate document itself and not an e-filing submission; both are
// disclosed as not built yet on the report page.
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role === "employee") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const currentYear = new Date().getUTCFullYear();
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

  const csvRows = [
    ["Employee", "TIN", "Gross Pay (NGN)", "PAYE (NGN)", "Pension - Employee (NGN)", "NHF (NGN)", "Rent Relief Claimed (NGN)"],
    ...rows.map(([, totals]) => [
      totals.fullName,
      totals.tin ?? "",
      toNaira(totals.grossKobo).toFixed(2),
      toNaira(totals.payeKobo).toFixed(2),
      toNaira(totals.pensionKobo).toFixed(2),
      toNaira(totals.nhfKobo).toFixed(2),
      toNaira(totals.rentReliefKobo).toFixed(2),
    ]),
  ];

  const csv = csvRows.map((row) => row.map((cell) => csvField(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="annual-tax-reconciliation-${year}.csv"`,
    },
  });
}
