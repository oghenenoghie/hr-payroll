import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { Badge, BenefitEnrollmentStatusBadge } from "@/components/Badge";
import { BenefitPlanForm } from "./BenefitPlanForm";
import { EnrollmentForm } from "./EnrollmentForm";
import { setBenefitPlanActive, cancelEnrollment } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const CATEGORY_LABEL: Record<string, string> = {
  health: "Health",
  life: "Life",
  pension_topup: "Pension top-up",
  wellness: "Wellness",
  other: "Other",
};

export default async function BenefitsPage() {
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

  const { data: plans } = await supabase.from("benefit_plans").select("*").order("created_at", { ascending: false });

  const { data: enrollments } = await supabase
    .from("employee_benefit_enrollments")
    .select("*, employees(full_name), benefit_plans(name)")
    .order("enrolled_at", { ascending: false });

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");

  const activePlans = (plans ?? []).filter((p) => p.active);
  const activeEnrollments = (enrollments ?? []).filter((e) => e.status === "active");
  const cancelledEnrollments = (enrollments ?? []).filter((e) => e.status !== "active");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Benefits Administration
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">Plan enrollment and employer cost per employee</h1>
        <p className="text-[13px] text-ink-soft">
          Active enrollments apply automatically in every pay run — employer cost as a company cost, employee cost
          as a post-tax deduction.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Plan catalog</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Plan</th>
                <th className={`${thClass} text-left`}>Category</th>
                <th className={`${thClass} text-right`}>Employer cost / period</th>
                <th className={`${thClass} text-right`}>Employee cost / period</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {plans && plans.length > 0 ? (
                plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{plan.name}</td>
                    <td className={`${tdClass} text-ink-soft`}>{CATEGORY_LABEL[plan.category] ?? plan.category}</td>
                    <td className={`${tdClass} text-right text-ink`}>
                      {formatKobo(BigInt(plan.employer_cost_kobo))}
                    </td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {formatKobo(BigInt(plan.employee_cost_kobo))}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Badge tone={plan.active ? "good" : "neutral"}>{plan.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <form action={setBenefitPlanActive.bind(null, plan.id, !plan.active)}>
                        <button type="submit" className="text-[12px] font-bold text-primary">
                          {plan.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No benefit plans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-card border border-border bg-surface p-6">
          <BenefitPlanForm />
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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Enrollments</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Employee</th>
                <th className={`${thClass} text-left`}>Plan</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {activeEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{enrollment.benefit_plans?.name ?? "—"}</td>
                  <td className={`${tdClass} text-center`}>
                    <BenefitEnrollmentStatusBadge status={enrollment.status} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <form action={cancelEnrollment.bind(null, enrollment.id)}>
                      <button type="submit" className="text-[12px] font-bold text-bad">
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {cancelledEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{enrollment.benefit_plans?.name ?? "—"}</td>
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
