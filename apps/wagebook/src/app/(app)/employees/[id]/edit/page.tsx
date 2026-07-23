import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditEmployeeForm } from "./EditEmployeeForm";
import { InviteAccountPanel } from "./InviteAccountPanel";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
  if (!employee) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
        <h1 className="text-[22px] font-extrabold text-ink">{employee.full_name}</h1>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <EditEmployeeForm employee={employee} />
      </div>
      <div className="rounded-card border border-border bg-surface p-6">
        <InviteAccountPanel employeeId={employee.id} email={employee.email} linkedAt={employee.linked_at} />
      </div>
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
    </div>
  );
}
