import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatePayRunForm } from "@/components/create-pay-run-form";

export default async function NewPayRunPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();

  if (!membership) {
    redirect("/setup");
  }
  if (membership.role !== "admin" && membership.role !== "payroll_manager") {
    redirect("/payroll-runs");
  }

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-lg mx-auto">
        <p className="label-micro mb-2">Payroll Runs</p>
        <h1 className="text-2xl font-extrabold mb-2">Run payroll</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          Computes every active employee&apos;s payslip against {"NG-2026.1"} —
          cumulative PAYE, pension, NHF and rent relief — and blocks up front if
          anyone is missing a TIN.
        </p>
        <div className="card">
          <CreatePayRunForm />
        </div>
      </div>
    </main>
  );
}
