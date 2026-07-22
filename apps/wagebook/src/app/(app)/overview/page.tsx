import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const email = (claimsData?.claims as { email?: string } | undefined)?.email ?? "unknown";

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role, organizations(name, default_pay_frequency, states_of_operation)")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/setup");
  }

  const org = membership.organizations as unknown as {
    name: string;
    default_pay_frequency: string;
    states_of_operation: string[];
  } | null;

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <p className="label-micro mb-2">Overview</p>
        <h1 className="text-2xl font-extrabold mb-1">{org?.name}</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-8">
          Signed in as {email} · role: {membership.role}
        </p>

        <div className="card">
          <p className="label-micro mb-4">Organization</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] py-2">
              <dt className="text-[var(--ink-soft)]">Default pay frequency</dt>
              <dd className="font-bold">{org?.default_pay_frequency}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[var(--ink-soft)]">States of operation</dt>
              <dd className="font-bold">
                {org?.states_of_operation && org.states_of_operation.length > 0
                  ? org.states_of_operation.join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-[var(--ink-soft)] mt-6">
          The full Overview dashboard — payroll runs, compliance status, headcount —
          comes later, once there&apos;s real data behind it. This confirms auth,
          your organization and role-scoped access are wired up correctly.{" "}
          <Link href="/paye-calculator" className="font-bold text-[var(--primary)]">
            Try the PAYE Calculator
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
