"use client";

import { useRouter } from "next/navigation";
import { ROLE_LABEL, DASHBOARD_ROLES } from "@/lib/roles";

// Admin-only widget preview: switches which role's widget set renders on
// /dashboard via a plain query param, so it's a normal navigation (no
// client state to lose on refresh, works with back/forward). The
// underlying widget queries still run under the admin's own real session
// — this only changes WHICH widgets are shown, never what data access
// backs them. See the banner in page.tsx for the same disclosure shown
// to the admin using it.
export function DashboardRoleSwitcher({ currentViewAs }: { currentViewAs?: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="view-as" className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
        View as
      </label>
      <select
        id="view-as"
        defaultValue={currentViewAs ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value ? `/dashboard?viewAs=${value}` : "/dashboard");
        }}
        className="rounded-control border border-border bg-surface px-3 py-1.5 text-[13px] font-bold text-ink outline-none focus:border-primary"
      >
        <option value="">My dashboard</option>
        {DASHBOARD_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </select>
    </div>
  );
}
