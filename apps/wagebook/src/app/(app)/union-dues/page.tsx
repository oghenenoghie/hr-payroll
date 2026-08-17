import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { Badge, BenefitEnrollmentStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { UnionDuesPlanForm } from "./UnionDuesPlanForm";
import { EnrollmentForm } from "./EnrollmentForm";
import { setUnionDuesPlanActive, cancelEnrollment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function UnionDuesPage() {
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

  const [{ data: plans }, { data: enrollments }, { data: employees }] = await Promise.all([
    supabase.from("union_dues_plans").select("*").order("created_at", { ascending: false }),
    supabase
      .from("employee_union_due_enrollments")
      .select("*, employees(full_name), union_dues_plans(name)")
      .order("enrolled_at", { ascending: false }),
    supabase.from("employees").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  const activePlans = (plans ?? []).filter((p) => p.active);
  const activeEnrollments = (enrollments ?? []).filter((e) => e.status === "active");
  const cancelledEnrollments = (enrollments ?? []).filter((e) => e.status !== "active");

  const plansCsv = toCsv(
    ["Union", "Due / Period (NGN)", "Status"],
    (plans ?? []).map((plan) => [plan.name, (plan.amount_kobo / 100).toFixed(2), plan.active ? "Active" : "Inactive"]),
  );

  const enrollmentsCsv = toCsv(
    ["Employee", "Union", "Status"],
    (enrollments ?? []).map((enrollment) => [
      enrollment.employees?.full_name ?? "—",
      enrollment.union_dues_plans?.name ?? "—",
      enrollment.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Trade Union Dues</span>
        <h1 className="text-[22px] font-extrabold text-ink">Union enrollment and per-employee due</h1>
        <p className="text-[13px] text-ink-soft">
          Active enrollments apply automatically in every pay run — a fixed amount withheld from the employee&apos;s
          own pay and remitted to the union, never an employer cost.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Recognized unions</span>
          {plans && plans.length > 0 && <ExportCsvButton csv={plansCsv} filename="union-dues-plans.csv" />}
        </div>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Union</th>
                <th className={`${thClass} text-right`}>Due / period</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {plans && plans.length > 0 ? (
                plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{plan.name}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(plan.amount_kobo))}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge tone={plan.active ? "good" : "neutral"}>{plan.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {plan.active ? (
                        <ConfirmActionButton
                          action={setUnionDuesPlanActive.bind(null, plan.id, false)}
                          label="Deactivate"
                          className="text-[12px] font-bold text-primary disabled:opacity-50"
                          confirmTitle="Deactivate this union?"
                          confirmMessage={`"${plan.name}" will no longer be available for new enrollments. Existing enrollments are unaffected.`}
                          confirmLabel="Deactivate"
                        />
                      ) : (
                        <form action={setUnionDuesPlanActive.bind(null, plan.id, true)}>
                          <FormSubmitButton className="text-[12px] font-bold text-primary">
                            Reactivate
                          </FormSubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No union dues plans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-card border border-border bg-surface p-6">
          <UnionDuesPlanForm />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Enroll an employee</span>
        <div className="rounded-card border border-border bg-surface p-6">
          <EnrollmentForm
            employees={(employees ?? []).map((e) => ({ id: e.id, label: e.full_name }))}
            plans={activePlans.map((p) => ({ id: p.id, label: p.name }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Enrollments</span>
          {enrollments && enrollments.length > 0 && <ExportCsvButton csv={enrollmentsCsv} filename="union-dues-enrollments.csv" />}
        </div>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-left`}>Union</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {activeEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{enrollment.union_dues_plans?.name ?? "—"}</td>
                  <td className={`${tdClass} text-center`}>
                    <BenefitEnrollmentStatusBadge status={enrollment.status} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConfirmActionButton
                      action={cancelEnrollment.bind(null, enrollment.id)}
                      label="Cancel"
                      confirmTitle="Cancel this enrollment?"
                      confirmMessage={`${enrollment.employees?.full_name ?? "This employee"}'s enrollment with "${enrollment.union_dues_plans?.name ?? "this union"}" will be cancelled.`}
                      confirmLabel="Cancel enrollment"
                    />
                  </td>
                </tr>
              ))}
              {cancelledEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{enrollment.union_dues_plans?.name ?? "—"}</td>
                  <td className={`${tdClass} text-center`}>
                    <BenefitEnrollmentStatusBadge status={enrollment.status} />
                  </td>
                  <td className={tdClass}></td>
                </tr>
              ))}
              {(enrollments ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No enrollments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
