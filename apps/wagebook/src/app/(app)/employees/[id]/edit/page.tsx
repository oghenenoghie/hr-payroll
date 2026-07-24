import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EditEmployeeForm } from "./EditEmployeeForm";
import { InviteAccountPanel } from "./InviteAccountPanel";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  // Reads through the salary-masked view (see migration comment): for an
  // hr_manager viewer of a salary_masked employee, the salary/bank columns
  // come back null, which is exactly the signal used below to hide those
  // fields from the edit form rather than a separate role check.
  const { data: employee } = await supabase.from("employees_masked").select("*").eq("id", id).maybeSingle();
  if (!employee) notFound();

  const { data: departments } = employee.org_id
    ? await supabase.from("departments").select("id, name").eq("org_id", employee.org_id).order("name")
    : { data: null };

  const { data: branches } = employee.org_id
    ? await supabase.from("branches").select("id, name").eq("org_id", employee.org_id).order("name")
    : { data: null };

  const { data: jobGrades } = employee.org_id
    ? await supabase
        .from("job_grades")
        .select("id, name, min_annual_kobo, max_annual_kobo")
        .eq("org_id", employee.org_id)
        .order("min_annual_kobo")
    : { data: null };

  const { data: managers } = employee.org_id
    ? await supabase
        .from("employees")
        .select("id, full_name")
        .eq("org_id", employee.org_id)
        .eq("status", "active")
        .neq("id", id)
        .order("full_name")
    : { data: null };

  const { data: statusHistory } = await supabase
    .from("employee_status_history")
    .select("old_status, new_status, changed_at")
    .eq("employee_id", id)
    .order("changed_at", { ascending: false });

  const canEditSalary = employee.basic_kobo !== null;
  const canControlMasking = membership?.role === "admin" || membership?.role === "payroll_manager";

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
        <h1 className="text-[22px] font-extrabold text-ink">{employee.full_name}</h1>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <EditEmployeeForm
          employee={employee}
          departments={departments ?? []}
          branches={branches ?? []}
          jobGrades={jobGrades ?? []}
          managers={managers ?? []}
          canEditSalary={canEditSalary}
          canControlMasking={canControlMasking}
        />
      </div>
      <div className="rounded-card border border-border bg-surface p-6">
        <InviteAccountPanel employeeId={employee.id!} email={employee.email} linkedAt={employee.linked_at} />
      </div>
      {statusHistory && statusHistory.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Status history</span>
          <div className="mt-3 flex flex-col gap-2">
            {statusHistory.map((change, index) => (
              <div key={index} className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink">
                  {change.old_status ?? "—"} → {change.new_status}
                </span>
                <span className="text-ink-soft">{new Date(change.changed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {employee.status === "terminated" && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Final settlement</span>
          <p className="mt-2 text-[13px] text-ink-soft">
            Exit payroll — gratuity, leave payout and loan clearance in one settlement run.
          </p>
          <Link
            href={`/employees/${employee.id}/settle`}
            className="mt-3 inline-block rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            Process final settlement
          </Link>
        </div>
      )}
    </div>
  );
}
