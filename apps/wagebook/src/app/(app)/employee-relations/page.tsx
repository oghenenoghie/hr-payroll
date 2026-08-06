import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { CaseTypeBadge, CaseStatusBadge, CaseSeverityBadge } from "@/components/Badge";
import { CaseForm } from "./CaseForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const ALLOWED_ROLES = ["admin", "hr_manager", "department_manager", "auditor", "chro", "legal_compliance"];
const CAN_CREATE_ROLES = ["admin", "hr_manager", "department_manager"];

export default async function EmployeeRelationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
    redirect("/dashboard");
  }

  const canCreate = CAN_CREATE_ROLES.includes(membership.role);
  const isDepartmentManager = membership.role === "department_manager";

  const { data: myEmployee } = isDepartmentManager
    ? await supabase.from("employees").select("department_id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  // RLS already scopes the rows returned to what this role can see — admin/
  // hr_manager get every case, a department manager only their own
  // department's, an auditor every case read-only — so no extra role
  // filtering is needed in this query.
  const [{ data: cases }, { data: employeesRaw }] = await Promise.all([
    supabase
      .from("employee_relations_cases")
      .select("id, case_type, title, severity, status, created_at, employees(full_name)")
      .order("created_at", { ascending: false }),
    canCreate
      ? isDepartmentManager && myEmployee?.department_id
        ? supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .eq("department_id", myEmployee.department_id)
            .order("full_name")
        : supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employee Relations</span>
        <h1 className="text-[22px] font-extrabold text-ink">Grievances, disciplinary matters &amp; investigations</h1>
        <p className="text-[13px] text-ink-soft">
          Case outcomes are communicated to the employee outside this system — cases are never visible to the
          employee they concern.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Employee</th>
              <th className={`${thClass} text-left`}>Title</th>
              <th className={`${thClass} text-center`}>Type</th>
              <th className={`${thClass} text-center`}>Severity</th>
              <th className={`${thClass} text-center`}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {cases && cases.length > 0 ? (
              cases.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{c.employees?.full_name ?? "—"}</td>
                  <td className={tdClass}>{c.title}</td>
                  <td className={`${tdClass} text-center`}>
                    <CaseTypeBadge caseType={c.case_type} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <CaseSeverityBadge severity={c.severity} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <CaseStatusBadge status={c.status} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/employee-relations/${c.id}`} className="font-bold text-primary">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No cases.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Open a case</span>
          <div className="mt-3">
            <CaseForm employees={employeesRaw ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
