import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmployeeForm } from "./EmployeeForm";

export default async function NewEmployeePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  const { data: departments } = membership
    ? await supabase.from("departments").select("id, name").eq("org_id", membership.orgId).order("name")
    : { data: null };
  const { data: jobGrades } = membership
    ? await supabase
        .from("job_grades")
        .select("id, name, min_annual_kobo, max_annual_kobo")
        .eq("org_id", membership.orgId)
        .order("min_annual_kobo")
    : { data: null };
  const { data: managers } = membership
    ? await supabase
        .from("employees")
        .select("id, full_name")
        .eq("org_id", membership.orgId)
        .eq("status", "active")
        .order("full_name")
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
        <h1 className="text-[22px] font-extrabold text-ink">Add employee</h1>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <EmployeeForm departments={departments ?? []} jobGrades={jobGrades ?? []} managers={managers ?? []} />
      </div>
    </div>
  );
}
