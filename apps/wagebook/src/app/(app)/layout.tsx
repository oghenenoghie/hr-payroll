import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { resolveNavSections } from "@/lib/nav-sections";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  // No org yet: the platform operator's first, manually provisioned login
  // — every other account is created by an existing admin (see
  // Security & Access), so this is the one legitimate way to reach org
  // creation. Onboarding only creates an org for the already-authenticated
  // user in front of it — it never creates a new login itself.
  if (!membership) {
    redirect("/onboarding");
  }

  // MFA is a stated product requirement for whichever roles `roles.mfa_required`
  // marks that way (Admin and Payroll Manager today) — a data change, not a
  // code change, if that set needs to grow. Gate every (app) route here
  // rather than a single entry-point page, since any of them could be the
  // first page a session lands on (deep link, bookmark, browser restore).
  if (membership.mfaRequired) {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const hasVerifiedTotp = (factorsData?.all ?? []).some(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );
    if (!hasVerifiedTotp) {
      redirect("/mfa-setup");
    }
  }

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Offboarding access revocation: an exited employee's payroll record is
  // marked terminated, but nothing previously acted on that — they kept a
  // live self-service login indefinitely. This gate applies regardless of
  // org_membership role, since a linked account is the thing being
  // revoked, not just the employee-role nav.
  if (myEmployee?.status === "terminated") {
    redirect("/account-revoked");
  }

  const { count: reportCount } = myEmployee
    ? await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", myEmployee.id)
    : { count: 0 };
  const isManager = (reportCount ?? 0) > 0;

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", user.id)
    .is("read_at", null);

  const sections = await resolveNavSections(supabase, membership.orgId, user.id, membership.role);

  return (
    <AppShell
      role={membership.role}
      sections={sections}
      isManager={isManager}
      unreadNotifications={unreadNotifications ?? 0}
      orgName={membership.orgName ?? "Your organization"}
    >
      {children}
    </AppShell>
  );
}
