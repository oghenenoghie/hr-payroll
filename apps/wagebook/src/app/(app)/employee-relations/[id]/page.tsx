import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { CaseTypeBadge, CaseStatusBadge, CaseSeverityBadge } from "@/components/Badge";
import { CaseNoteForm } from "./CaseNoteForm";
import { ResolveCaseForm } from "./ResolveCaseForm";

const ALLOWED_ROLES = ["admin", "hr_manager", "department_manager", "auditor", "chro", "legal_compliance"];
const CAN_ADD_NOTE_ROLES = ["admin", "hr_manager", "department_manager"];

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
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

  const { data: caseRow } = await supabase
    .from("employee_relations_cases")
    .select("id, case_type, title, description, severity, status, resolution, created_at, resolved_at, employees(full_name)")
    .eq("id", caseId)
    .maybeSingle();

  if (!caseRow) {
    notFound();
  }

  const { data: notes } = await supabase
    .from("employee_relations_case_notes")
    .select("id, action_type, note, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  const canResolve = (membership.role === "admin" || membership.role === "hr_manager") && caseRow.status !== "resolved" && caseRow.status !== "closed";
  const canAddNote = CAN_ADD_NOTE_ROLES.includes(membership.role) && caseRow.status !== "resolved" && caseRow.status !== "closed";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/employee-relations" className="text-[12px] font-bold text-primary">
          ← Employee Relations
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          {caseRow.employees?.full_name ?? "—"}
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">{caseRow.title}</h1>
        <div className="flex items-center gap-2">
          <CaseTypeBadge caseType={caseRow.case_type} />
          <CaseSeverityBadge severity={caseRow.severity} />
          <CaseStatusBadge status={caseRow.status} />
        </div>
        {caseRow.description && <p className="text-[13px] text-ink-soft">{caseRow.description}</p>}
      </header>

      {caseRow.resolution && (
        <div className="rounded-card border border-good bg-good-tint p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-good">Resolution</span>
          <p className="mt-1 text-[13px] text-ink">{caseRow.resolution}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Timeline</span>
        <div className="flex flex-col gap-2">
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <div key={note.id} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                    {note.action_type.replace("_", " ")}
                  </span>
                  <span className="text-[12px] text-ink-soft">
                    {new Date(note.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-ink">{note.note}</p>
              </div>
            ))
          ) : (
            <div className="rounded-card border border-border bg-surface px-3 py-8 text-center text-[13px] text-ink-soft">
              No notes yet.
            </div>
          )}
        </div>
      </div>

      {canAddNote && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a note</span>
          <div className="mt-3">
            <CaseNoteForm caseId={caseRow.id} />
          </div>
        </div>
      )}

      {canResolve && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Resolve case</span>
          <div className="mt-3">
            <ResolveCaseForm caseId={caseRow.id} />
          </div>
        </div>
      )}
    </div>
  );
}
