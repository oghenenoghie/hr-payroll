import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { getCachedDepartments, getCachedBranches, getCachedJobGrades } from "@/lib/reference-data";
import { Badge } from "@/components/Badge";
import { EditEmployeeForm } from "./EditEmployeeForm";
import { OffboardingChecklistForm } from "./OffboardingChecklistForm";
import { OnboardingChecklistForm } from "./OnboardingChecklistForm";
import { EmployeeDocumentsPanel } from "./EmployeeDocumentsPanel";

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

  const isTerminated = employee.status === "terminated";

  // None of these depends on another's result — org-scoped lookups only
  // need employee.org_id (already known), the rest only need id/isTerminated
  // (already known) — so they run as one batch instead of up to 9
  // sequential round-trips.
  const [
    departments,
    branches,
    jobGrades,
    { data: managers },
    { data: statusHistory },
    { data: onboardingChecklist },
    { data: offboardingChecklist },
    { data: finalSettlement },
    { data: documentsRaw },
  ] = await Promise.all([
    employee.org_id ? getCachedDepartments(employee.org_id) : Promise.resolve([]),
    employee.org_id ? getCachedBranches(employee.org_id) : Promise.resolve([]),
    employee.org_id ? getCachedJobGrades(employee.org_id) : Promise.resolve([]),
    employee.org_id
      ? supabase
          .from("employees")
          .select("id, full_name")
          .eq("org_id", employee.org_id)
          .eq("status", "active")
          .neq("id", id)
          .order("full_name")
      : Promise.resolve({ data: null }),
    supabase
      .from("employee_status_history")
      .select("old_status, new_status, changed_at")
      .eq("employee_id", id)
      .order("changed_at", { ascending: false }),
    !isTerminated
      ? supabase
          .from("employee_onboarding_checklist")
          .select("documentation_collected, contract_signed")
          .eq("employee_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isTerminated
      ? supabase
          .from("employee_offboarding_checklist")
          .select("notice_period_served, assets_returned, clearance_obtained, experience_letter_issued")
          .eq("employee_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isTerminated
      ? supabase.from("final_settlements").select("id").eq("employee_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("employee_documents")
      .select("id, file_name, document_type, storage_path, uploaded_at")
      .eq("employee_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);

  // Signed URLs since the bucket is private — generated per request, not
  // stored, so a deleted or access-revoked document never leaves a stale
  // working link lying around.
  const documents = await Promise.all(
    (documentsRaw ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(doc.storage_path, 60 * 10);
      return { ...doc, downloadUrl: signed?.signedUrl ?? null };
    }),
  );

  const canEditSalary = employee.basic_kobo !== null;
  const canControlMasking = membership?.role === "admin" || membership?.role === "payroll_manager";
  const canManageDocuments = membership?.role === "admin" || membership?.role === "hr_manager";

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
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employee account</span>
        {employee.linked_at ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="good">Linked</Badge>
            <span className="text-[12.5px] text-ink-soft">
              {employee.email} · since {new Date(employee.linked_at).toLocaleDateString("en-NG")}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-ink-soft">
            No login yet.{" "}
            <Link href="/security/new" className="font-bold text-primary">
              Create one from Security &amp; Access →
            </Link>
          </p>
        )}
      </div>
      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Documents</span>
        <div className="mt-3">
          <EmployeeDocumentsPanel employeeId={employee.id!} documents={documents} canManage={canManageDocuments} />
        </div>
      </div>
      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Employment &amp; salary certificate
        </span>
        <p className="mt-2 text-[13px] text-ink-soft">
          A printable document confirming employment and current salary — a common request for loan and visa
          applications.
        </p>
        <Link href={`/employees/${employee.id}/certificate`} className="mt-3 inline-block text-[13px] font-bold text-primary">
          Generate certificate →
        </Link>
      </div>
      {!isTerminated && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Onboarding checklist</span>
          <div className="mt-3">
            <OnboardingChecklistForm
              employeeId={employee.id!}
              checklist={onboardingChecklist}
              hasDocuments={documents.length > 0}
            />
          </div>
        </div>
      )}
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
      {isTerminated && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Offboarding checklist</span>
          <div className="mt-3">
            <OffboardingChecklistForm
              employeeId={employee.id!}
              checklist={offboardingChecklist}
              accessRevoked={isTerminated}
              settlementProcessed={!!finalSettlement}
            />
          </div>
        </div>
      )}
    </div>
  );
}
