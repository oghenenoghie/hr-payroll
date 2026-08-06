import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { BranchForm } from "./BranchForm";
import { deleteBranch } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BranchesPage() {
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

  const [{ data: branches }, { data: employees }] = await Promise.all([
    supabase.from("branches").select("*").order("name"),
    supabase.from("employees").select("branch_id"),
  ]);

  const employeeCountByBranch = new Map<string, number>();
  for (const employee of employees ?? []) {
    if (!employee.branch_id) continue;
    employeeCountByBranch.set(employee.branch_id, (employeeCountByBranch.get(employee.branch_id) ?? 0) + 1);
  }

  const csv = toCsv(
    ["Branch", "State", "Address", "Employees"],
    (branches ?? []).map((branch) => [
      branch.name,
      branch.state ?? "",
      branch.address ?? "",
      employeeCountByBranch.get(branch.id) ?? 0,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Branches</span>
          {branches && branches.length > 0 && <ExportCsvButton csv={csv} filename="branches.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Locations for employee work assignment</h1>
        <p className="text-[13px] text-ink-soft">
          Assign employees to a branch on their edit page. A branch&apos;s state is a work-location record only — it
          doesn&apos;t drive PAYE routing, which is based on each employee&apos;s own state of residence.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Branch</th>
              <th className={`${thClass} text-left`}>State</th>
              <th className={`${thClass} text-left`}>Address</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {branches && branches.length > 0 ? (
              branches.map((branch) => (
                <tr key={branch.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{branch.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>{branch.state ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{branch.address ?? "—"}</td>
                  <td className={`${tdClass} text-center text-ink-soft`}>
                    {employeeCountByBranch.get(branch.id) ?? 0}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConfirmActionButton
                      action={deleteBranch.bind(null, branch.id)}
                      label="Delete"
                      confirmTitle="Delete this branch?"
                      confirmMessage={`"${branch.name}" will be removed. Employees currently assigned to it keep their record but lose this branch assignment.`}
                      confirmLabel="Delete"
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No branches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <BranchForm />
      </div>
    </div>
  );
}
