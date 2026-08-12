"use client";

import { useState } from "react";
import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { signOut } from "./dashboard/actions";
import { ROLE_LABEL } from "@/lib/roles";

// Desktop-only persistent header, living inside the floating content panel
// in AppShell — the mobile header (hamburger + brand) is a separate,
// unchanged element for narrow viewports, so the two never stack. The
// title is derived from the same nav data SidebarNav renders from (see
// buildNavGroups), not a second hardcoded map, so it can't drift out of
// sync as nav items are added — it's a coarse "which section am I in"
// label, not a replacement for each page's own, more specific heading.
export function TopBar({
  title,
  orgName,
  role,
  unreadNotifications,
}: {
  title?: string;
  orgName: string;
  role?: string;
  unreadNotifications: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = orgName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="hidden items-center justify-between border-b border-border px-6 py-4 md:flex print:hidden">
      <span className="text-[16px] font-extrabold text-ink">{title ?? orgName}</span>
      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-control text-ink-soft hover:bg-bg"
        >
          <BellIcon className="h-[18px] w-[18px]" />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-badge bg-bad px-1 text-[10px] font-extrabold text-white">
              {unreadNotifications}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-bg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-[13px] font-extrabold text-primary-dark">
              {initial}
            </span>
            <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 fill-none stroke-current stroke-2 text-ink-soft">
              <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-panel border border-border bg-surface p-3 shadow-md">
                <div className="flex flex-col gap-0.5 border-b border-border pb-2">
                  <span className="truncate text-[13px] font-bold text-ink">{orgName}</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                    {role ? (ROLE_LABEL[role] ?? role) : ""}
                  </span>
                </div>
                <form action={signOut} className="pt-2">
                  <FormSubmitButton className="w-full rounded-control border border-border px-3 py-2 text-[12.5px] font-bold text-ink hover:bg-bg">
                    Sign out
                  </FormSubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
