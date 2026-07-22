import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  employee: "Employee",
};

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
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Plutus Technologies
          </span>
          <h1 className="text-[22px] font-extrabold text-ink">{org?.name ?? "Your organization"}</h1>
          <p className="text-[13px] text-ink-soft">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-button border border-border bg-surface px-[16px] py-[9px] text-[13px] font-bold text-ink"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Your role</span>
        <div className="mt-2 inline-block rounded-badge border border-primary bg-primary-tint px-3 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-primary-dark">
          {ROLE_LABEL[membership.role] ?? membership.role}
        </div>
      </div>

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
