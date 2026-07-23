import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { TinBadge, EmployeeStatusBadge, BankDetailsBadge } from "@/components/Badge";
import { getMembership } from "@/lib/membership";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function EmployeesPage() {
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

  // Queries the salary-masked view rather than the raw table — for an
  // hr_manager viewer, any employee flagged salary_masked comes back with
  // null salary/bank columns (see the migration comment for why); admin
  // and payroll_manager always see real values through the same view.
  const { data: employees } = await supabase
    .from("employees_masked")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
          <h1 className="text-[22px] font-extrabold text-ink">Directory</h1>
          <p className="text-[13px] text-ink-soft">Directory, TIN status and self-service</p>
        </div>
        <Link
          href="/employees/new"
          className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
        >
          + Add employee
        </Link>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Name</th>
              <th className={`${thClass} text-left`}>Department</th>
              <th className={`${thClass} text-left`}>State</th>
              <th className={`${thClass} text-right`}>Basic</th>
              <th className={`${thClass} text-center`}>TIN</th>
              <th className={`${thClass} text-center`}>Bank details</th>
              <th className={`${thClass} text-center`}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {employees && employees.length > 0 ? (
              employees.map((employee) => (
                <tr key={employee.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{employee.full_name}</td>
                  <td className={`${tdClass} text-ink-soft`}>{employee.department_name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{employee.state_of_residence ?? "—"}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>
                    {employee.basic_kobo !== null ? (
                      formatKobo(BigInt(employee.basic_kobo))
                    ) : (
                      <span className="font-normal text-ink-soft">Restricted</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <TinBadge tin={employee.tin} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    {employee.salary_masked && employee.bank_account_number === null ? (
                      <span className="text-ink-soft">Restricted</span>
                    ) : (
                      <BankDetailsBadge bankAccountNumber={employee.bank_account_number} />
                    )}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <EmployeeStatusBadge status={employee.status ?? "active"} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/employees/${employee.id}/edit`} className="font-bold text-primary">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
