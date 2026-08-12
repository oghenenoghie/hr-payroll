import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard-widgets";
import { WidgetVisibilityRow } from "./WidgetVisibilityRow";

export default async function DashboardVisibilityPage() {
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

  const [{ data: roles }, { data: assignments }] = await Promise.all([
    supabase.from("roles").select("key, label").order("sort_order"),
    supabase.from("dashboard_widget_visibility").select("widget_key, role_key").eq("org_id", membership.orgId),
  ]);

  const assignedRoleKeysByWidget = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = assignedRoleKeysByWidget.get(row.widget_key) ?? [];
    list.push(row.role_key);
    assignedRoleKeysByWidget.set(row.widget_key, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
        <h1 className="text-[22px] font-extrabold text-ink">Dashboard visibility</h1>
        <p className="text-[13px] text-ink-soft">
          Choose which roles see each widget on /dashboard, one at a time. A widget you haven&apos;t touched shows
          to its own sensible default roles; saving here replaces that default with exactly the roles you check.
          This only changes what renders on the dashboard — it never changes what any role can actually query or do
          anywhere else in the app, since every widget&apos;s data still goes through the same RLS every other page uses.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {DASHBOARD_WIDGETS.map((widget) => (
          <div key={widget.key} className="rounded-card border border-border bg-surface p-6">
            <WidgetVisibilityRow
              widgetKey={widget.key}
              widgetLabel={widget.label}
              widgetDescription={widget.description}
              defaultRoleKeys={widget.defaultRoles}
              roles={roles ?? []}
              assignedRoleKeys={assignedRoleKeysByWidget.get(widget.key) ?? null}
            />
          </div>
        ))}
      </div>

      <Link href="/dashboard" className="w-fit text-[13px] font-bold text-primary">
        ← Back to dashboard
      </Link>
    </div>
  );
}
