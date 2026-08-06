import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { MemberRoleForm } from "./MemberRoleForm";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("roles").select("key, label, mfa_required").order("sort_order"),
    supabase
      .from("org_memberships")
      .select("user_id, role, created_at")
      .eq("org_id", membership.orgId)
      .order("created_at", { ascending: true }),
  ]);
  const mfaRequiredRoles = new Set((roles ?? []).filter((r) => r.mfa_required).map((r) => r.key));
  const mfaRequiredLabels = (roles ?? []).filter((r) => r.mfa_required).map((r) => r.label);

  const admin = createAdminClient();
  const rows = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      const hasVerifiedTotp = (data.user?.factors ?? []).some(
        (factor) => factor.factor_type === "totp" && factor.status === "verified",
      );
      return {
        userId: m.user_id,
        role: m.role,
        email: data.user?.email ?? "—",
        fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? null,
        mfaEnabled: hasVerifiedTotp,
      };
    }),
  );

  const csv = toCsv(
    ["Member", "Email", "Role", "Two-Factor Authentication"],
    rows.map((row) => [
      row.fullName ?? "",
      row.email,
      row.role,
      row.mfaEnabled ? "Enabled" : mfaRequiredRoles.has(row.role) ? "Required — not set up" : "Not enabled",
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
          {rows.length > 0 && <ExportCsvButton csv={csv} filename="org-members.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Role-based access and MFA, at a glance</h1>
        <p className="text-[13px] text-ink-soft">
          Two-factor authentication is required for {mfaRequiredLabels.join(" and ")} — those accounts are gated
          into setup on their next sign-in until they enroll.
        </p>
        <Link href="/security/new" className="mt-2 w-fit text-[13px] font-bold text-primary">
          + Add team member
        </Link>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Member</th>
              <th className={`${thClass} text-right`}>Role</th>
              <th className={`${thClass} text-center`}>Two-factor authentication</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b border-border last:border-b-0">
                <td className={tdClass}>
                  <div className="font-bold text-ink">{row.fullName ?? row.email}</div>
                  {row.fullName && <div className="text-ink-soft">{row.email}</div>}
                </td>
                <td className={tdClass}>
                  <MemberRoleForm userId={row.userId} currentRole={row.role} roles={roles ?? []} />
                </td>
                <td className={`${tdClass} text-center`}>
                  {row.mfaEnabled ? (
                    <Badge tone="good">Enabled</Badge>
                  ) : mfaRequiredRoles.has(row.role) ? (
                    <Badge tone="bad">Required — not set up</Badge>
                  ) : (
                    <Badge tone="neutral">Not enabled</Badge>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/security/${row.userId}`} className="font-bold text-primary">
                    Access
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link href="/security/audit-log" className="w-fit text-[13px] font-bold text-primary">
          View audit log →
        </Link>
        <Link href="/security/modules" className="w-fit text-[13px] font-bold text-primary">
          Manage module visibility →
        </Link>
        <Link href="/security/dashboards" className="w-fit text-[13px] font-bold text-primary">
          Manage dashboard visibility →
        </Link>
      </div>
    </div>
  );
}
