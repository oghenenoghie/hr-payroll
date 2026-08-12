import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { MODULES } from "@/lib/feature-modules";
import { ModuleVisibilityRow } from "./ModuleVisibilityRow";

export default async function ModuleVisibilityPage() {
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
    supabase.from("module_role_visibility").select("module_key, role_key").eq("org_id", membership.orgId),
  ]);

  const assignedRoleKeysByModule = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = assignedRoleKeysByModule.get(row.module_key) ?? [];
    list.push(row.role_key);
    assignedRoleKeysByModule.set(row.module_key, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
        <h1 className="text-[22px] font-extrabold text-ink">Module visibility</h1>
        <p className="text-[13px] text-ink-soft">
          Choose which roles see each module on the Full Feature Map, one at a time. A module you haven&apos;t
          touched stays visible to every role; assigning roles here restricts it to just those. This only affects
          what shows on that page — it never changes what any role can actually do or see anywhere else in the app.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {MODULES.map((module) => (
          <div key={module.key} className="rounded-card border border-border bg-surface p-6">
            <ModuleVisibilityRow
              moduleKey={module.key}
              moduleName={module.name}
              roles={roles ?? []}
              assignedRoleKeys={assignedRoleKeysByModule.get(module.key) ?? []}
            />
          </div>
        ))}
      </div>

      <Link href="/featuremap" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Full Feature Map
      </Link>
    </div>
  );
}
