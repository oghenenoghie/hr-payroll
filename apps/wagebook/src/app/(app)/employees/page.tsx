import { redirect } from "next/navigation";
import Link from "next/link";
import { isTinValid } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();

  if (!membership) {
    redirect("/setup");
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, state_of_residence, basic_kobo, housing_kobo, transport_kobo, tin, tin_valid_from, tin_valid_to, status")
    .order("full_name");

  const today = new Date().toISOString().slice(0, 10);
  const canManage = membership.role === "admin" || membership.role === "hr_manager";

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="label-micro mb-2">Employees</p>
            <h1 className="text-2xl font-extrabold">{employees?.length ?? 0} on the roster</h1>
          </div>
          {canManage ? (
            <Link
              href="/employees/new"
              className="inline-block rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
            >
              Add employee
            </Link>
          ) : null}
        </div>

        <div className="card overflow-x-auto">
          {!employees || employees.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No employees yet.{" "}
              {canManage ? (
                <Link href="/employees/new" className="font-bold text-[var(--primary)]">
                  Add the first one
                </Link>
              ) : null}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--border)]">
                  <th className="label-micro pb-2 pr-4">Name</th>
                  <th className="label-micro pb-2 pr-4">State</th>
                  <th className="label-micro pb-2 pr-4 text-right">Monthly gross</th>
                  <th className="label-micro pb-2 pr-4">TIN</th>
                  <th className="label-micro pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const gross = employee.basic_kobo + employee.housing_kobo + employee.transport_kobo;
                  const tinValid = isTinValid(
                    {
                      tin: employee.tin,
                      validFrom: employee.tin_valid_from ?? undefined,
                      validTo: employee.tin_valid_to ?? undefined,
                    },
                    today,
                  );
                  return (
                    <tr key={employee.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-3 pr-4 font-bold">{employee.full_name}</td>
                      <td className="py-3 pr-4 text-[var(--ink-soft)]">{employee.state_of_residence ?? "—"}</td>
                      <td className="py-3 pr-4 text-right font-bold">{formatKobo(gross)}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            tinValid
                              ? "rounded-md bg-[var(--good-tint)] text-[var(--good)] text-xs font-bold px-2 py-0.5"
                              : "rounded-md bg-[var(--warn-tint)] text-[var(--warn)] text-xs font-bold px-2 py-0.5"
                          }
                        >
                          {tinValid ? "On file" : "Missing"}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--ink-soft)] capitalize">{employee.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
