import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
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

  // MFA is a stated product requirement for Admin and Payroll Manager,
  // never optional for those roles. Gate every (app) route here rather
  // than a single entry-point page, since any of them could be the first
  // page a session lands on (deep link, bookmark, browser restore).
  if (membership?.role === "admin" || membership?.role === "payroll_manager") {
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

  return (
    <AppShell
      role={membership?.role}
      isManager={isManager}
      unreadNotifications={unreadNotifications ?? 0}
      orgName={membership?.orgName ?? "Your organization"}
    >
      {children}
    </AppShell>
  );
}
