import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { PolicyForm } from "./PolicyForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function PoliciesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { data: policies } = await supabase
    .from("company_policies")
    .select("*")
    .order("created_at", { ascending: false });

  const { count: activeEmployeeCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Only ever non-empty for admin/hr_manager viewers, per this table's RLS.
  const { data: acknowledgements } = await supabase
    .from("policy_acknowledgements")
    .select("policy_id, acknowledged_at");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Company Policies</span>
        <h1 className="text-[22px] font-extrabold text-ink">Publish policies and track acknowledgement</h1>
        <p className="text-[13px] text-ink-soft">
          Editing a policy doesn&apos;t re-notify anyone or force anything — the completion count below only counts
          acknowledgements made on or after the policy&apos;s current version, so an edit shows up as incomplete
          again until employees re-acknowledge.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Policy</th>
              <th className={`${thClass} text-center`}>Acknowledged</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {policies && policies.length > 0 ? (
              policies.map((policy) => {
                const acknowledgedCount = (acknowledgements ?? []).filter(
                  (a) => a.policy_id === policy.id && a.acknowledged_at >= policy.updated_at,
                ).length;
                return (
                  <tr key={policy.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{policy.title}</td>
                    <td className={`${tdClass} text-center text-ink-soft`}>
                      {acknowledgedCount} of {activeEmployeeCount ?? 0}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link href={`/policies/${policy.id}/edit`} className="font-bold text-primary">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No policies published yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <PolicyForm />
      </div>
    </div>
  );
}
