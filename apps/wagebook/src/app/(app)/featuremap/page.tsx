import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";
import { MODULES, isModuleVisibleForRole, type ModuleStatus } from "@/lib/feature-modules";

const STATUS_LABEL: Record<ModuleStatus, string> = { live: "Live", partial: "Partial", roadmap: "Roadmap" };
const STATUS_TONE: Record<ModuleStatus, "good" | "warn" | "neutral"> = { live: "good", partial: "warn", roadmap: "neutral" };

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function FeatureMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  // A user with no org yet (mid-onboarding) sees every module unfiltered —
  // there's no org_id to scope an assignment lookup against, and this page
  // is documentation, not a gate.
  let visibleModules = MODULES;
  if (membership) {
    const { data: assignments } = await supabase
      .from("module_role_visibility")
      .select("module_key, role_key")
      .eq("org_id", membership.orgId);

    const assignmentsByModule = new Map<string, Set<string>>();
    for (const row of assignments ?? []) {
      const set = assignmentsByModule.get(row.module_key) ?? new Set<string>();
      set.add(row.role_key);
      assignmentsByModule.set(row.module_key, set);
    }

    visibleModules = MODULES.filter((module) => isModuleVisibleForRole(module.key, membership.role, assignmentsByModule));
  }

  const liveCount = visibleModules.filter((m) => m.status === "live").length;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Full Feature Map</span>
        <h1 className="text-[22px] font-extrabold text-ink">
          Every payroll &amp; HR capability this platform is built to cover
        </h1>
        <p className="text-[13px] text-ink-soft">
          {liveCount} of {visibleModules.length} modules are live in this build today — the rest are honestly
          flagged Roadmap or Partial, not implied as built.
        </p>
        {membership?.role === "admin" && (
          <Link href="/security/modules" className="mt-1 w-fit text-[12.5px] font-bold text-primary">
            Manage module visibility →
          </Link>
        )}
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Module</th>
              <th className={`${thClass} text-left`}>What&apos;s here</th>
              <th className={`${thClass} text-center`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((module) => (
              <tr key={module.key} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} font-bold text-ink`}>{module.name}</td>
                <td className={`${tdClass} text-ink-soft`}>{module.description}</td>
                <td className={`${tdClass} text-center`}>
                  <Badge tone={STATUS_TONE[module.status]}>{STATUS_LABEL[module.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
