import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { AnnualTaxCertificate } from "@/components/AnnualTaxCertificate";
import { PrintButton } from "@/components/PrintButton";

export default async function MyTaxCertificatePage({
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

  const { data: employee } = await supabase.from("employees").select("id, full_name, tin").eq("user_id", user.id).maybeSingle();
  if (!employee) {
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
          .select("gross_kobo, paye_kobo, pension_employee_kobo, nhf_kobo, rent_relief_kobo, net_kobo")
          .eq("employee_id", employee.id)
          .in("pay_run_id", payRunIds)
      : { data: [] };

  const totals = (payslips ?? []).reduce(
    (acc, slip) => ({
      grossKobo: acc.grossKobo + BigInt(slip.gross_kobo),
      payeKobo: acc.payeKobo + BigInt(slip.paye_kobo),
      pensionKobo: acc.pensionKobo + BigInt(slip.pension_employee_kobo),
      nhfKobo: acc.nhfKobo + BigInt(slip.nhf_kobo),
      rentReliefKobo: acc.rentReliefKobo + BigInt(slip.rent_relief_kobo),
      netKobo: acc.netKobo + BigInt(slip.net_kobo),
    }),
    { grossKobo: 0n, payeKobo: 0n, pensionKobo: 0n, nhfKobo: 0n, rentReliefKobo: 0n, netKobo: 0n },
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/me" className="text-[13px] font-bold text-primary">
          ← Back to overview
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <AnnualTaxCertificate
        orgName={membership?.orgName ?? "Your organization"}
        fullName={employee.full_name}
        tin={employee.tin}
        year={year}
        {...totals}
      />
    </div>
  );
}
