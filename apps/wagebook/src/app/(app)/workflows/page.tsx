import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { WorkflowStepForm } from "./WorkflowStepForm";
import { deleteWorkflowStep } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const APPROVER_KIND_LABEL: Record<string, string> = {
  role: "Role",
  reporting_manager: "Employee's reporting manager",
  department_manager: "Employee's department manager",
  specific_user: "Specific person",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Super Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  accountant: "Accountant",
  department_manager: "Department Manager",
  auditor: "Auditor",
  employee: "Employee",
};

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: steps } = await supabase
    .from("approval_workflow_steps")
    .select("*")
    .eq("org_id", membership.orgId)
    .eq("request_type", "leave_request")
    .order("step_order");

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("user_id, role")
    .eq("org_id", membership.orgId);

  const admin = createAdminClient();
  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { userId: m.user_id, role: m.role, email: data.user?.email ?? m.user_id };
    }),
  );
  const emailByUserId = new Map(members.map((m) => [m.userId, m.email]));

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Approval Workflows</span>
        <h1 className="text-[22px] font-extrabold text-ink">Leave request approval steps</h1>
        <p className="text-[13px] text-ink-soft">
          Configure who reviews leave requests, in order. Multiple approvers at the same step number are
          alternatives — any one of them can act. Leave this empty and leave requests keep their default routing:
          Super Admin or HR Manager, or the employee&apos;s own reporting or department manager. Loans, expenses,
          overtime and leave encashment aren&apos;t wired to this engine yet and keep their existing approval rules.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-center`}>Step</th>
              <th className={`${thClass} text-left`}>Approver</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {steps && steps.length > 0 ? (
              steps.map((step) => (
                <tr key={step.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-center font-bold text-ink`}>{step.step_order}</td>
                  <td className={tdClass}>
                    {APPROVER_KIND_LABEL[step.approver_kind] ?? step.approver_kind}
                    {step.approver_kind === "role" && step.approver_role
                      ? ` — ${ROLE_LABEL[step.approver_role] ?? step.approver_role}`
                      : ""}
                    {step.approver_kind === "specific_user" && step.approver_user_id
                      ? ` — ${emailByUserId.get(step.approver_user_id) ?? step.approver_user_id}`
                      : ""}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <form action={deleteWorkflowStep.bind(null, step.id)}>
                      <button type="submit" className="text-[12px] font-bold text-bad">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No custom steps configured — using default routing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a step</span>
        <div className="mt-4">
          <WorkflowStepForm members={members} roleLabels={ROLE_LABEL} />
        </div>
      </div>
    </div>
  );
}
