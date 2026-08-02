import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { CandidateStageBadge, InterviewOutcomeBadge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { CandidateForm } from "./CandidateForm";
import { CandidateStageSelect } from "./CandidateStageSelect";
import { ScheduleInterviewForm } from "./ScheduleInterviewForm";
import { RejectCandidateForm } from "./RejectCandidateForm";
import { hireCandidate } from "../actions";

const tdClass = "px-3 py-[10px] text-[13px]";

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: requisitionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    redirect("/recruitment");
  }

  const { data: requisition } = await supabase
    .from("job_requisitions")
    .select("id, title, description, status, departments(name), job_grades(name)")
    .eq("id", requisitionId)
    .maybeSingle();

  if (!requisition) {
    notFound();
  }

  const [{ data: candidates }, { data: interviewersRaw }] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, email, phone, resume_link, source, stage, rejected_reason, notes, candidate_interviews(id, scheduled_at, outcome, notes, interviewer_id)")
      .eq("requisition_id", requisitionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("employees")
      .select("user_id, full_name")
      .eq("org_id", membership.orgId)
      .eq("status", "active")
      .not("user_id", "is", null)
      .order("full_name"),
  ]);

  const interviewers = (interviewersRaw ?? [])
    .filter((employee): employee is { user_id: string; full_name: string } => Boolean(employee.user_id))
    .map((employee) => ({ user_id: employee.user_id, full_name: employee.full_name }));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/recruitment" className="text-[12px] font-bold text-primary">
          ← Recruitment
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          {requisition.departments?.name ?? "No department"} · {requisition.job_grades?.name ?? "No job grade"}
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">{requisition.title}</h1>
        {requisition.description && <p className="text-[13px] text-ink-soft">{requisition.description}</p>}
      </header>

      <div className="flex flex-col gap-3">
        {candidates && candidates.length > 0 ? (
          candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-ink">{candidate.full_name}</span>
                  <span className="text-[12px] text-ink-soft">
                    {candidate.email ?? "—"} {candidate.phone ? `· ${candidate.phone}` : ""}
                  </span>
                </div>
                {candidate.stage === "hired" ? (
                  <CandidateStageBadge stage="hired" />
                ) : (
                  <CandidateStageSelect candidateId={candidate.id} requisitionId={requisitionId} stage={candidate.stage} />
                )}
              </div>

              {candidate.resume_link && (
                <a
                  href={candidate.resume_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[12.5px] font-bold text-primary"
                >
                  Resume →
                </a>
              )}

              {candidate.rejected_reason && (
                <p className={`${tdClass} mt-1 text-bad`}>Rejected: {candidate.rejected_reason}</p>
              )}

              {candidate.candidate_interviews && candidate.candidate_interviews.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Interviews</span>
                  {candidate.candidate_interviews.map((interview) => (
                    <div key={interview.id} className="flex items-center justify-between text-[12.5px] text-ink-soft">
                      <span>
                        {new Date(interview.scheduled_at).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <InterviewOutcomeBadge outcome={interview.outcome} />
                    </div>
                  ))}
                </div>
              )}

              {candidate.stage !== "hired" && candidate.stage !== "rejected" && (
                <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                  <details className="rounded-control border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-ink">
                      Schedule an interview
                    </summary>
                    <div className="border-t border-border p-3">
                      <ScheduleInterviewForm
                        candidateId={candidate.id}
                        requisitionId={requisitionId}
                        interviewers={interviewers}
                      />
                    </div>
                  </details>

                  <div className="flex items-center justify-between gap-3">
                    <ConfirmActionButton
                      action={hireCandidate.bind(null, candidate.id, requisitionId)}
                      label="Hire"
                      tone="primary"
                      className="text-[12.5px] font-bold text-good"
                      confirmTitle="Hire this candidate?"
                      confirmMessage={`${candidate.full_name} will get a real employee record. Compensation, banking and a login are filled in afterward from the Employees and Security & Access pages.`}
                      confirmLabel="Hire"
                    />
                  </div>

                  <details className="rounded-control border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-bad">
                      Reject candidate
                    </summary>
                    <div className="border-t border-border p-3">
                      <RejectCandidateForm candidateId={candidate.id} requisitionId={requisitionId} />
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
            No candidates yet.
          </div>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a candidate</span>
        <div className="mt-3">
          <CandidateForm requisitionId={requisitionId} />
        </div>
      </div>
    </div>
  );
}
