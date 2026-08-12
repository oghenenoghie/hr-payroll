import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { GoalStatusBadge, AppraisalStatusBadge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { GoalForm } from "./GoalForm";
import { GoalStatusSelect } from "./GoalStatusSelect";
import { AppraisalSubmitForm } from "./AppraisalSubmitForm";
import { AcknowledgeAppraisalForm } from "./AcknowledgeAppraisalForm";
import { createOwnGoal, createGoalForEmployee, deleteGoal, startAppraisal } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function PerformancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  const isHrOrAdmin = membership.role === "admin" || membership.role === "hr_manager";

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: cycles } = await supabase
    .from("performance_review_cycles")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  const currentCycle = (cycles ?? []).find((c) => c.status === "active") ?? (cycles ?? [])[0] ?? null;

  const { data: myGoals } = myEmployee
    ? await supabase
        .from("performance_goals")
        .select("id, title, description, target_date, status, performance_review_cycles(name)")
        .eq("employee_id", myEmployee.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: myAppraisals } = myEmployee
    ? await supabase
        .from("performance_appraisals")
        .select(
          "id, rating, strengths, areas_for_improvement, manager_comments, status, submitted_at, acknowledged_at, performance_review_cycles(name)",
        )
        .eq("employee_id", myEmployee.id)
        .order("created_at", { ascending: false })
    : { data: null };

  // Team scope: org-wide for admin/hr_manager, direct reports otherwise.
  // Department Manager isn't included here — no performance permission
  // was ever seeded for that role (see the migration's own rationale).
  const { data: teamEmployees } = isHrOrAdmin
    ? await supabase.from("employees").select("id, full_name").eq("org_id", membership.orgId).order("full_name")
    : myEmployee
      ? await supabase.from("employees").select("id, full_name").eq("manager_id", myEmployee.id).order("full_name")
      : { data: null };

  const teamEmployeeIds = (teamEmployees ?? []).map((e) => e.id);

  const { data: teamGoals } =
    teamEmployeeIds.length > 0
      ? await supabase
          .from("performance_goals")
          .select("id, title, status, target_date, employee_id, employees(full_name)")
          .in("employee_id", teamEmployeeIds)
          .order("created_at", { ascending: false })
      : { data: null };

  const { data: teamAppraisals } =
    teamEmployeeIds.length > 0 && currentCycle
      ? await supabase
          .from("performance_appraisals")
          .select("id, status, employee_id, rating, employees(full_name)")
          .in("employee_id", teamEmployeeIds)
          .eq("cycle_id", currentCycle.id)
          .order("created_at", { ascending: false })
      : { data: null };

  const employeeIdsWithAppraisal = new Set((teamAppraisals ?? []).map((a) => a.employee_id));
  const employeesNeedingAppraisal = (teamEmployees ?? []).filter((e) => !employeeIdsWithAppraisal.has(e.id));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Performance Management
          </span>
          {isHrOrAdmin && (
            <Link href="/performance/cycles" className="text-[12px] font-bold text-primary">
              Manage review cycles →
            </Link>
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Goals, appraisals and review cycles</h1>
        <p className="text-[13px] text-ink-soft">
          Set goals against a review cycle, and work through appraisals — a manager rates and comments, the
          employee reads and acknowledges. {currentCycle ? `Current cycle: ${currentCycle.name}.` : "No review cycle exists yet."}
        </p>
      </header>

      {myEmployee && (
        <section className="flex flex-col gap-5">
          <h2 className="text-[16px] font-extrabold text-ink">My goals and appraisals</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">My goals</span>
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${thClass} text-left`}>Goal</th>
                    <th className={`${thClass} text-left`}>Cycle</th>
                    <th className={`${thClass} text-left`}>Target date</th>
                    <th className={`${thClass} text-center`}>Status</th>
                    <th className={thClass}></th>
                  </tr>
                </thead>
                <tbody>
                  {myGoals && myGoals.length > 0 ? (
                    myGoals.map((goal) => (
                      <tr key={goal.id} className="border-b border-border last:border-b-0">
                        <td className={`${tdClass} font-bold text-ink`}>{goal.title}</td>
                        <td className={`${tdClass} text-ink-soft`}>{goal.performance_review_cycles?.name ?? "—"}</td>
                        <td className={`${tdClass} text-ink-soft`}>{goal.target_date ?? "—"}</td>
                        <td className={`${tdClass} text-center`}>
                          <GoalStatusSelect goalId={goal.id} status={goal.status} />
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <ConfirmActionButton
                            action={deleteGoal.bind(null, goal.id)}
                            label="Delete"
                            confirmTitle="Delete this goal?"
                            confirmMessage={`"${goal.title}" will be removed.`}
                            confirmLabel="Delete"
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                        No goals yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-border bg-surface p-6">
              <GoalForm action={createOwnGoal} cycles={cycles ?? []} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">My appraisals</span>
            {myAppraisals && myAppraisals.length > 0 ? (
              <div className="flex flex-col gap-3">
                {myAppraisals.map((appraisal) => (
                  <div key={appraisal.id} className="rounded-card border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-ink">
                        {appraisal.performance_review_cycles?.name ?? "—"}
                      </span>
                      <AppraisalStatusBadge status={appraisal.status} />
                    </div>
                    {appraisal.status !== "draft" && (
                      <div className="mt-2 flex flex-col gap-1 text-[13px] text-ink-soft">
                        <span>Rating: {appraisal.rating ?? "—"}/5</span>
                        {appraisal.strengths && <span>Strengths: {appraisal.strengths}</span>}
                        {appraisal.areas_for_improvement && (
                          <span>Areas for improvement: {appraisal.areas_for_improvement}</span>
                        )}
                        {appraisal.manager_comments && <span>Manager comments: {appraisal.manager_comments}</span>}
                      </div>
                    )}
                    {appraisal.status === "submitted" && (
                      <div className="mt-3">
                        <AcknowledgeAppraisalForm appraisalId={appraisal.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
                No appraisals yet.
              </div>
            )}
          </div>
        </section>
      )}

      {teamEmployees && teamEmployees.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="text-[16px] font-extrabold text-ink">
            {isHrOrAdmin ? "Organization goals and appraisals" : "Your reports' goals and appraisals"}
          </h2>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Goals</span>
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${thClass} text-left`}>Employee</th>
                    <th className={`${thClass} text-left`}>Goal</th>
                    <th className={`${thClass} text-left`}>Target date</th>
                    <th className={`${thClass} text-center`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamGoals && teamGoals.length > 0 ? (
                    teamGoals.map((goal) => (
                      <tr key={goal.id} className="border-b border-border last:border-b-0">
                        <td className={`${tdClass} font-bold text-ink`}>{goal.employees?.full_name ?? "—"}</td>
                        <td className={tdClass}>{goal.title}</td>
                        <td className={`${tdClass} text-ink-soft`}>{goal.target_date ?? "—"}</td>
                        <td className={`${tdClass} text-center`}>
                          <GoalStatusBadge status={goal.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                        No goals recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-border bg-surface p-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a goal</span>
              <div className="mt-3 flex flex-col gap-3">
                {teamEmployees.map((employee) => (
                  <details key={employee.id} className="rounded-control border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-[13px] font-bold text-ink">
                      {employee.full_name}
                    </summary>
                    <div className="border-t border-border p-3">
                      <GoalForm action={createGoalForEmployee.bind(null, employee.id)} cycles={cycles ?? []} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>

          {currentCycle && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                Appraisals — {currentCycle.name}
              </span>

              {teamAppraisals && teamAppraisals.length > 0 && (
                <div className="flex flex-col gap-3">
                  {teamAppraisals.map((appraisal) => (
                    <div key={appraisal.id} className="rounded-card border border-border bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-ink">{appraisal.employees?.full_name ?? "—"}</span>
                        <AppraisalStatusBadge status={appraisal.status} />
                      </div>
                      {appraisal.status === "draft" ? (
                        <div className="mt-3">
                          <AppraisalSubmitForm appraisalId={appraisal.id} />
                        </div>
                      ) : (
                        <p className="mt-2 text-[13px] text-ink-soft">Rated {appraisal.rating ?? "—"}/5.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {employeesNeedingAppraisal.length > 0 && (
                <div className="rounded-card border border-border bg-surface p-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                    Not yet started this cycle
                  </span>
                  <div className="mt-2 flex flex-col gap-2">
                    {employeesNeedingAppraisal.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between">
                        <span className="text-[13px] text-ink">{employee.full_name}</span>
                        <ConfirmActionButton
                          action={startAppraisal.bind(null, employee.id, currentCycle.id)}
                          label="Start appraisal"
                          tone="primary"
                          className="text-[12px] font-bold text-primary"
                          confirmTitle="Start this appraisal?"
                          confirmMessage={`A draft appraisal for ${employee.full_name} in ${currentCycle.name} will be created for you to fill in.`}
                          confirmLabel="Start"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
