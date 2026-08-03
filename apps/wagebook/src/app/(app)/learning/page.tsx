import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { TrainingCategoryBadge, TrainingEnrollmentStatusBadge, Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { EnrollForm } from "./EnrollForm";
import { markEnrollmentComplete, deleteEnrollment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default async function LearningPage() {
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
  const isDepartmentManager = membership.role === "department_manager";
  const canViewOrgTraining =
    isHrOrAdmin || isDepartmentManager || ["auditor", "chro", "legal_compliance"].includes(membership.role);

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: myEnrollments }, { data: orgEnrollments }, { data: employees }, { data: courses }] =
    await Promise.all([
      myEmployee
        ? supabase
            .from("training_enrollments")
            .select("id, status, due_date, completed_at, training_courses(title, category, is_mandatory)")
            .eq("employee_id", myEmployee.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
      // RLS already scopes the rows returned to what this role can see —
      // admin/hr_manager get every enrollment, a department manager only
      // their own department's, auditor/chro/legal_compliance every
      // enrollment read-only — so no extra role filtering is needed here.
      canViewOrgTraining
        ? supabase
            .from("training_enrollments")
            .select("id, status, due_date, employee_id, employees(full_name), training_courses(title, category, is_mandatory)")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
      isHrOrAdmin
        ? supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .order("full_name")
        : Promise.resolve({ data: null }),
      isHrOrAdmin
        ? supabase.from("training_courses").select("id, title").order("title")
        : Promise.resolve({ data: null }),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Learning &amp; Development
          </span>
          {isHrOrAdmin && (
            <Link href="/learning/courses" className="text-[12px] font-bold text-primary">
              Manage courses →
            </Link>
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Training courses and completion tracking</h1>
        <p className="text-[13px] text-ink-soft">
          A course is a catalog entry with an optional link to the actual material — this app assigns and tracks
          training, it doesn&apos;t host any content itself. Completion is self-reported by the employee.
        </p>
      </header>

      {myEmployee && (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">My training</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Course</th>
                  <th className={`${thClass} text-center`}>Category</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {myEnrollments && myEnrollments.length > 0 ? (
                  myEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>
                        {enrollment.training_courses?.title ?? "—"}
                        {enrollment.training_courses?.is_mandatory && (
                          <span className="ml-2">
                            <Badge tone="bad">Mandatory</Badge>
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingCategoryBadge category={enrollment.training_courses?.category ?? "other"} />
                      </td>
                      <td className={`${tdClass} text-ink-soft`}>{formatDate(enrollment.due_date)}</td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingEnrollmentStatusBadge status={enrollment.status} />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {enrollment.status === "assigned" && (
                          <ConfirmActionButton
                            action={markEnrollmentComplete.bind(null, enrollment.id)}
                            label="Mark complete"
                            tone="primary"
                            className="text-[12px] font-bold text-primary"
                            confirmTitle="Mark this course complete?"
                            confirmMessage="This confirms you've completed the training — it isn't verified against any quiz or certificate."
                            confirmLabel="Mark complete"
                          />
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No training assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canViewOrgTraining && (
        <section className="flex flex-col gap-5">
          <h2 className="text-[16px] font-extrabold text-ink">
            {isDepartmentManager && !isHrOrAdmin ? "Your department's training" : "Organization training"}
          </h2>

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-left`}>Course</th>
                  <th className={`${thClass} text-center`}>Category</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  {isHrOrAdmin && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {orgEnrollments && orgEnrollments.length > 0 ? (
                  orgEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                      <td className={tdClass}>{enrollment.training_courses?.title ?? "—"}</td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingCategoryBadge category={enrollment.training_courses?.category ?? "other"} />
                      </td>
                      <td className={`${tdClass} text-ink-soft`}>{formatDate(enrollment.due_date)}</td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingEnrollmentStatusBadge status={enrollment.status} />
                      </td>
                      {isHrOrAdmin && (
                        <td className={`${tdClass} text-right`}>
                          <ConfirmActionButton
                            action={deleteEnrollment.bind(null, enrollment.id)}
                            label="Remove"
                            confirmTitle="Remove this enrollment?"
                            confirmMessage={`${enrollment.employees?.full_name ?? "This employee"}'s assignment to "${enrollment.training_courses?.title ?? "this course"}" will be removed.`}
                            confirmLabel="Remove"
                          />
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isHrOrAdmin ? 6 : 5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No training assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isHrOrAdmin && (
            <div className="rounded-card border border-border bg-surface p-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Assign training</span>
              <div className="mt-3">
                <EnrollForm employees={employees ?? []} courses={courses ?? []} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
