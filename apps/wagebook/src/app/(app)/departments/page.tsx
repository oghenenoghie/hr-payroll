import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { DepartmentForm } from "./DepartmentForm";
import { deleteDepartment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function DepartmentsPage() {
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

  const { data: departments } = await supabase.from("departments").select("*").order("name");

  const { data: employees } = await supabase.from("employees").select("department_id");

  const employeeCountByDepartment = new Map<string, number>();
  for (const employee of employees ?? []) {
    if (!employee.department_id) continue;
    employeeCountByDepartment.set(
      employee.department_id,
      (employeeCountByDepartment.get(employee.department_id) ?? 0) + 1,
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Departments</span>
        <h1 className="text-[22px] font-extrabold text-ink">Cost centres for employee assignment and GL export</h1>
        <p className="text-[13px] text-ink-soft">
          Assign employees to a department on their edit page. The general ledger export attributes each employee&apos;s
          postings to their department as a cost centre.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Department</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {departments && departments.length > 0 ? (
              departments.map((department) => (
                <tr key={department.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{department.name}</td>
                  <td className={`${tdClass} text-center text-ink-soft`}>
                    {employeeCountByDepartment.get(department.id) ?? 0}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <form action={deleteDepartment.bind(null, department.id)}>
                      <button type="submit" className="text-[12px] font-bold text-bad">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <DepartmentForm />
      </div>
    </div>
  );
}
