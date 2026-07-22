import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddEmployeeForm } from "@/components/add-employee-form";

export default async function NewEmployeePage() {
  const supabase = await createClient();

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();

  if (!membership) {
    redirect("/setup");
  }
  if (membership.role !== "admin" && membership.role !== "hr_manager") {
    redirect("/employees");
  }

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-lg mx-auto">
        <p className="label-micro mb-2">Employees</p>
        <h1 className="text-2xl font-extrabold mb-6">Add employee</h1>
        <div className="card">
          <AddEmployeeForm orgId={membership.org_id} />
        </div>
      </div>
    </main>
  );
}
