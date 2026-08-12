"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { SectionKey } from "@/lib/nav-sections";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { signOut } from "./dashboard/actions";
import { SidebarNav, buildNavGroups } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { ROLE_LABEL } from "@/lib/roles";

export function AppShell({
  role,
  sections,
  isManager,
  unreadNotifications,
  orgName,
  children,
}: {
  role?: string;
  sections: SectionKey[];
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

  // Reuses the exact same nav data SidebarNav renders from — a coarse
  // "which section is this" label for the top bar, not a hardcoded
  // second copy of every route's title that could drift as nav items are
  // added. Longest-matching href wins so a nested route (e.g.
  // /fixed-assets/depreciation) resolves to its own more specific label
  // rather than its parent's.
  const navGroups = buildNavGroups(role, sections, isManager);
  const matchingItems = navGroups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const pageTitle = matchingItems.sort((a, b) => b.href.length - a.href.length)[0]?.label;

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row print:block print:h-auto print:overflow-visible">
      <header className="flex items-center justify-between border-b border-primary bg-primary-dark px-4 py-3 md:hidden print:hidden">
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
          className="fixed inset-0 z-40 bg-ink/40 md:hidden print:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col justify-between overflow-y-auto bg-primary-dark px-4 py-6 transition-transform duration-200 md:static md:translate-x-0 md:transition-none print:hidden ${
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
          <SidebarNav role={role} sections={sections} isManager={isManager} unreadNotifications={unreadNotifications} />
        </div>

        <div className="flex flex-col gap-3 border-t border-primary px-2 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[12.5px] font-bold text-white">{orgName}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-primary-tint">
              {role ? (ROLE_LABEL[role] ?? role) : ""}
            </span>
          </div>
          <form action={signOut}>
            <FormSubmitButton className="w-full rounded-control border border-primary-tint px-3 py-2 text-[12.5px] font-bold text-primary-tint">
              Sign out
            </FormSubmitButton>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg p-0 md:p-4 print:h-auto print:overflow-visible print:bg-transparent print:p-0">
        <div className="flex min-h-full flex-col rounded-none border-0 bg-bg shadow-none md:rounded-container md:border md:border-border md:bg-surface md:shadow-sm print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
          <TopBar title={pageTitle} orgName={orgName} role={role} unreadNotifications={unreadNotifications} />
          <div className="flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
