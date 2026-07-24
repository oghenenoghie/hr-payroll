"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "./dashboard/actions";
import { SidebarNav } from "./SidebarNav";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  employee: "Employee",
};

export function AppShell({
  role,
  isManager,
  unreadNotifications,
  orgName,
  children,
}: {
  role?: string;
  isManager: boolean;
  unreadNotifications: number;
  orgName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [renderedPathname, setRenderedPathname] = useState(pathname);

  // The nav is a slide-in drawer below md — close it the moment a link
  // navigates, since a mobile user expects the drawer to get out of the way
  // rather than sit open over the page they just chose. Adjusted during
  // render (React's documented pattern for resetting state on a changed
  // prop) rather than an effect, which would call setState after an extra
  // render instead of before the first paint of the new page.
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <header className="flex items-center justify-between border-b border-primary bg-primary-dark px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-control text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-extrabold text-white">Plutus</span>
          <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.03em] text-primary-tint">
            {orgName}
          </span>
        </div>
      </header>

      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col justify-between overflow-y-auto bg-primary-dark px-4 py-6 transition-transform duration-200 md:static md:translate-x-0 md:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold text-white">Plutus</span>
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.03em] text-primary-tint">
                Technologies
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="flex h-8 w-8 items-center justify-center rounded-control text-primary-tint md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <SidebarNav role={role} isManager={isManager} unreadNotifications={unreadNotifications} />
        </div>

        <div className="flex flex-col gap-3 border-t border-primary px-2 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[12.5px] font-bold text-white">{orgName}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-primary-tint">
              {role ? (ROLE_LABEL[role] ?? role) : ""}
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-control border border-primary-tint px-3 py-2 text-[12.5px] font-bold text-primary-tint"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
    </div>
  );
}
