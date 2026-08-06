import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { getCachedDepartments, getCachedJobGrades } from "@/lib/reference-data";
import { InterviewOutcomeBadge } from "@/components/Badge";
import { RequisitionForm } from "./RequisitionForm";
import { RequisitionStatusSelect } from "./RequisitionStatusSelect";
import { InterviewOutcomeForm } from "./InterviewOutcomeForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function RecruitmentPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Interviewing is role-agnostic — any employee can be asked to sit in
  // on one — so "your interviews" is fetched for everyone, same as
  // Performance Management's "my goals and appraisals" section.
  const { data: myInterviews } = await supabase
    .from("candidate_interviews")
    .select("id, scheduled_at, notes, outcome, candidates(full_name, job_requisitions(title))")
    .eq("interviewer_id", user.id)
    .order("scheduled_at", { ascending: false });

  // Open/on_hold requisitions are the active work queue — every one
  // still needs hiring attention, so that fetch stays unbounded
  // (naturally bounded by how many roles are genuinely open at once).
  // Closed/filled requisitions are historical and grow without bound
  // over the org's lifetime, so that's the part that's paginated.
  const [activeResult, closedResult, departments, jobGrades] = isHrOrAdmin
    ? await Promise.all([
        supabase
          .from("job_requisitions")
          .select("id, title, status, department_id, job_grade_id, candidates(id)")
          .in("status", ["open", "on_hold"])
          .order("created_at", { ascending: false }),
        supabase
          .from("job_requisitions")
          .select("id, title, status, department_id, job_grade_id, candidates(id)", { count: "exact" })
          .in("status", ["closed", "filled"])
          .order("created_at", { ascending: false })
          .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
        getCachedDepartments(membership.orgId),
        getCachedJobGrades(membership.orgId),
      ])
    : [{ data: null }, { data: null, count: 0 }, [], []];

  const activeRequisitions = activeResult.data ?? [];
  const closedRequisitions = closedResult.data ?? [];
  const requisitions = [...activeRequisitions, ...closedRequisitions];

  const totalClosed = closedResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalClosed / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/recruitment?page=${page}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Recruitment</span>
        <h1 className="text-[22px] font-extrabold text-ink">Open roles, candidates and interviews</h1>
        <p className="text-[13px] text-ink-soft">
          Hiring a candidate creates their employee record directly — compensation, banking and a login are
          filled in afterward from the Employees and Security &amp; Access pages, same as any other new hire.
        </p>
      </header>

      {myInterviews && myInterviews.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[16px] font-extrabold text-ink">Your interviews</h2>
          <div className="flex flex-col gap-3">
            {myInterviews.map((interview) => (
              <div key={interview.id} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-ink">{interview.candidates?.full_name ?? "—"}</span>
                    <span className="text-[12px] text-ink-soft">
                      {interview.candidates?.job_requisitions?.title ?? "—"} ·{" "}
                      {new Date(interview.scheduled_at).toLocaleString("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <InterviewOutcomeBadge outcome={interview.outcome} />
                </div>
                <InterviewOutcomeForm interviewId={interview.id} outcome={interview.outcome} notes={interview.notes} />
              </div>
            ))}
          </div>
        </section>
      )}

      {isHrOrAdmin && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[16px] font-extrabold text-ink">Requisitions</h2>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Title</th>
                  <th className={`${thClass} text-center`}>Candidates</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {requisitions && requisitions.length > 0 ? (
                  requisitions.map((requisition) => (
                    <tr key={requisition.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>{requisition.title}</td>
                      <td className={`${tdClass} text-center text-ink-soft`}>
                        {requisition.candidates?.length ?? 0}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        <RequisitionStatusSelect requisitionId={requisition.id} status={requisition.status} />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link href={`/recruitment/${requisition.id}`} className="text-[12.5px] font-bold text-primary">
                          View pipeline →
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No requisitions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-soft">
                Page {currentPage} of {totalPages} · {totalClosed} closed/filled requisition
                {totalClosed === 1 ? "" : "s"}
              </span>
              <div className="flex gap-3">
                {currentPage > 1 ? (
                  <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                    ← Previous
                  </Link>
                ) : (
                  <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
                )}
                {currentPage < totalPages ? (
                  <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                    Next →
                  </Link>
                ) : (
                  <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
                )}
              </div>
            </div>
          )}
          <div className="rounded-card border border-border bg-surface p-6">
            <RequisitionForm departments={departments} jobGrades={jobGrades} />
          </div>
        </section>
      )}
    </div>
  );
}
