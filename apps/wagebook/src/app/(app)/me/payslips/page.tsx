import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function MyPayslipsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase.from("employees").select("id, full_name").eq("user_id", user.id).maybeSingle();
  if (!employee) redirect("/me");

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // posted_payslips (not payslips directly) excludes any payslip still on
  // a draft pay run — the same "nothing counts until approved" rule
  // /me's own "Latest payslip" card already follows. Ownership, not
  // role: scoped to this login's own linked employee record only.
  const {
    data: payslips,
    count,
  } = await supabase
    .from("posted_payslips")
    .select("id, net_kobo, gross_kobo, pay_runs(period_start, period_end)", { count: "exact" })
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1);

  const totalPayslips = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPayslips / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/me/payslips?page=${page}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/me" className="text-[12px] font-bold text-primary">
          ← Overview
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payslips</span>
        <h1 className="text-[22px] font-extrabold text-ink">{employee.full_name}&apos;s payslips</h1>
        <p className="text-[13px] text-ink-soft">
          Every payslip from a posted pay run — never a draft, since nothing counts until an admin or payroll
          manager approves it.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-right`}>Net pay</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {payslips && payslips.length > 0 ? (
              payslips.map((slip) => (
                <tr key={slip.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>
                    {slip.pay_runs?.period_start} – {slip.pay_runs?.period_end}
                  </td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(slip.net_kobo ?? 0))}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/me/payslips/${slip.id}`} className="font-bold text-primary">
                      Print / Save as PDF →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-soft">
            Page {currentPage} of {totalPages} · {totalPayslips} payslip{totalPayslips === 1 ? "" : "s"} total
          </span>
          <div className="flex gap-3">
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                ← Previous
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
            )}
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                Next →
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
