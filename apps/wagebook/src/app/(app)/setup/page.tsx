import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateOrganizationForm } from "@/components/create-organization-form";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("org_memberships").select("org_id").limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/overview");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="card max-w-md w-full">
        <p className="label-micro mb-2">Setup &amp; Onboarding</p>
        <h1 className="text-xl font-extrabold mb-2">Create your organization</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          You&apos;ll be the first admin. Invite Payroll Managers, HR Managers and
          Employees once your organization exists.
        </p>
        <CreateOrganizationForm />
      </div>
    </main>
  );
}
