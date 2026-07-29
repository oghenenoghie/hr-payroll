import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { defaultSectionsForRole, resolveNavSections } from "@/lib/nav-sections";
import { AccessForm } from "./AccessForm";

export default async function MemberAccessPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: target } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", membership.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!target) notFound();

  const { data: roleRow } = await supabase.from("roles").select("label").eq("key", target.role).maybeSingle();

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const displayName = (authUser.user?.user_metadata?.full_name as string | undefined) ?? authUser.user?.email ?? "Member";

  const effectiveSections = await resolveNavSections(supabase, membership.orgId, userId, target.role);
  const roleDefaults = defaultSectionsForRole(target.role);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
        <h1 className="text-[22px] font-extrabold text-ink">{displayName}&apos;s access</h1>
        <p className="text-[13px] text-ink-soft">
          {roleRow?.label ?? target.role}&apos;s usual menu is checked by default. Toggle a section on or off just
          for this person — everyone else with the same role keeps the default.
        </p>
      </header>

      <div className="rounded-card border border-border bg-surface p-6">
        <AccessForm userId={userId} effectiveSections={effectiveSections} roleDefaults={roleDefaults} />
      </div>

      <Link href="/security" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Security &amp; Access
      </Link>
    </div>
  );
}
