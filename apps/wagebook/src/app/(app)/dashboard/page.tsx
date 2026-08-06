import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard-widgets";
import { ROLE_LABEL, DASHBOARD_ROLES } from "@/lib/roles";
import { DashboardRoleSwitcher } from "./DashboardRoleSwitcher";
import { AnimatedWidgetGrid } from "./AnimatedWidgetGrid";
import {
  OrgSnapshotWidget,
  PendingApprovalsWidget,
  PayrollSnapshotWidget,
  WorkforceSnapshotWidget,
  ComplianceAuditWidget,
  AccountsSnapshotWidget,
  BudgetSnapshotWidget,
  CompensationSnapshotWidget,
  RecruitmentSnapshotWidget,
  PerformanceSnapshotWidget,
  LearningSnapshotWidget,
  MyTeamSnapshotWidget,
} from "./widgets";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  if (membership.role === "employee") {
    redirect("/me");
  }

  // Admin-only widget-set preview: which role's widgets render, driven by
  // a plain query param rather than any session/permission change. Every
  // widget below still queries under the ADMIN'S OWN real access — this
  // never simulates another role's actual RLS-scoped data, only which
  // widgets from the catalog would show up for them. See
  // DashboardRoleSwitcher and the banner below for the same disclosure
  // surfaced to the admin using it.
  const { viewAs } = await searchParams;
  const isPreviewing = membership.role === "admin" && !!viewAs && DASHBOARD_ROLES.includes(viewAs);
  const effectiveRole = isPreviewing ? viewAs! : membership.role;

  // A widget's visibility is the org's own override set if one exists at
  // all for that widget, otherwise the widget's own defaultRoles — the
  // same "zero rows = default, any rows = authoritative" shape
  // module_role_visibility already established for the Full Feature Map.
  const { data: overrides } = await supabase
    .from("dashboard_widget_visibility")
    .select("widget_key, role_key")
    .eq("org_id", membership.orgId);

  const overrideRolesByWidget = new Map<string, Set<string>>();
  for (const row of overrides ?? []) {
    const set = overrideRolesByWidget.get(row.widget_key) ?? new Set<string>();
    set.add(row.role_key);
    overrideRolesByWidget.set(row.widget_key, set);
  }

  const visibleWidgets = DASHBOARD_WIDGETS.filter((widget) => {
    const overrideRoles = overrideRolesByWidget.get(widget.key);
    const effectiveRoles = overrideRoles ?? new Set(widget.defaultRoles);
    return effectiveRoles.has(effectiveRole);
  });

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overview</span>
            <h1 className="text-[22px] font-extrabold text-ink">{membership.orgName ?? "Your organization"}</h1>
            <p className="text-[13px] text-ink-soft">Signed in as {user.email}</p>
          </div>
          {membership.role === "admin" && <DashboardRoleSwitcher currentViewAs={viewAs} />}
        </div>
        {isPreviewing && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-panel border border-warn bg-warn-tint px-4 py-2.5">
            <span className="text-[12.5px] font-bold text-warn">
              Previewing the {ROLE_LABEL[effectiveRole] ?? effectiveRole} dashboard — widgets only, every widget
              below still uses your own data access, not that role&apos;s.
            </span>
            <Link href="/dashboard" className="shrink-0 text-[12.5px] font-bold text-warn underline">
              Exit preview
            </Link>
          </div>
        )}
      </header>

      {visibleWidgets.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
          Nothing configured for your role yet. Ask an admin to check /security/dashboards.
        </div>
      ) : (
        <AnimatedWidgetGrid>
          {visibleWidgets.map((widget) => (
            <WidgetSwitch key={widget.key} widgetKey={widget.key} orgId={membership.orgId} userId={user.id} />
          ))}
        </AnimatedWidgetGrid>
      )}
    </div>
  );
}

async function WidgetSwitch({ widgetKey, orgId, userId }: { widgetKey: string; orgId: string; userId: string }) {
  const supabase = await createClient();

  switch (widgetKey) {
    case "org_snapshot":
      return <OrgSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "pending_approvals":
      return <PendingApprovalsWidget supabase={supabase} orgId={orgId} />;
    case "payroll_snapshot":
      return <PayrollSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "workforce_snapshot":
      return <WorkforceSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "compliance_audit":
      return <ComplianceAuditWidget supabase={supabase} orgId={orgId} />;
    case "accounts_snapshot":
      return <AccountsSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "budget_snapshot":
      return <BudgetSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "compensation_snapshot":
      return <CompensationSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "recruitment_snapshot":
      return <RecruitmentSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "performance_snapshot":
      return <PerformanceSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "learning_snapshot":
      return <LearningSnapshotWidget supabase={supabase} orgId={orgId} />;
    case "my_team_snapshot":
      return <MyTeamSnapshotWidget supabase={supabase} orgId={orgId} userId={userId} />;
    default:
      return null;
  }
}
