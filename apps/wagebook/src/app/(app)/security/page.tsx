import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  employee: "Employee",
};

const MFA_REQUIRED_ROLES = new Set(["admin", "payroll_manager"]);

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

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("user_id, role, created_at")
    .eq("org_id", membership.orgId)
    .order("created_at", { ascending: true });

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
        mfaEnabled: hasVerifiedTotp,
      };
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
        <h1 className="text-[22px] font-extrabold text-ink">Role-based access and MFA, at a glance</h1>
        <p className="text-[13px] text-ink-soft">
          Two-factor authentication is required for Admin and Payroll Manager — those accounts are gated into
          setup on their next sign-in until they enroll.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Member</th>
              <th className={`${thClass} text-left`}>Role</th>
              <th className={`${thClass} text-center`}>Two-factor authentication</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} font-bold text-ink`}>{row.email}</td>
                <td className={`${tdClass} text-ink-soft`}>{ROLE_LABEL[row.role] ?? row.role}</td>
                <td className={`${tdClass} text-center`}>
                  {row.mfaEnabled ? (
                    <Badge tone="good">Enabled</Badge>
                  ) : MFA_REQUIRED_ROLES.has(row.role) ? (
                    <Badge tone="bad">Required — not set up</Badge>
                  ) : (
                    <Badge tone="neutral">Not enabled</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
