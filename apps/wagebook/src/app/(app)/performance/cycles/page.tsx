import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { CycleForm } from "./CycleForm";
import { CycleStatusSelect } from "./CycleStatusSelect";
import { deleteReviewCycle } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function PerformanceCyclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    redirect("/performance");
  }

  const { data: cycles } = await supabase
    .from("performance_review_cycles")
    .select("*")
    .order("period_start", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/performance" className="text-[12px] font-bold text-primary">
          ← Performance Management
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Review Cycles</span>
        <h1 className="text-[22px] font-extrabold text-ink">Periods goals and appraisals are tracked against</h1>
        <p className="text-[13px] text-ink-soft">
          Active cycles are the ones employees and managers set goals and author appraisals against. Closing a
          cycle doesn&apos;t lock its records — it just signals the period is over.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Cycle</th>
              <th className={`${thClass} text-left`}>Period</th>
              <th className={`${thClass} text-center`}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {cycles && cycles.length > 0 ? (
              cycles.map((cycle) => (
                <tr key={cycle.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{cycle.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>
                    {cycle.period_start} – {cycle.period_end}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <CycleStatusSelect cycleId={cycle.id} status={cycle.status} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConfirmActionButton
                      action={deleteReviewCycle.bind(null, cycle.id)}
                      label="Delete"
                      confirmTitle="Delete this review cycle?"
                      confirmMessage={`"${cycle.name}" and every goal or appraisal tied to it will be removed. This can't be undone.`}
                      confirmLabel="Delete"
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No review cycles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <CycleForm />
      </div>
    </div>
  );
}
