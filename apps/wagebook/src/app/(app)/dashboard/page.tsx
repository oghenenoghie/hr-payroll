import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("role, organizations(name, default_pay_frequency, states_of_operation)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const membership = memberships[0]!;
  const org = membership.organizations;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overview</span>
        <h1 className="text-[22px] font-extrabold text-ink">{org?.name ?? "Your organization"}</h1>
        <p className="text-[13px] text-ink-soft">Signed in as {user.email}</p>
      </header>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pay frequency</span>
        <p className="mt-1 text-[13px] font-bold text-ink">{org?.default_pay_frequency ?? "—"}</p>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">States of operation</span>
        <p className="mt-1 text-[13px] font-bold text-ink">
          {org?.states_of_operation && org.states_of_operation.length > 0 ? org.states_of_operation.join(", ") : "None yet"}
        </p>
      </div>
    </div>
  );
}
