"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import type { SectionKey } from "@/lib/nav-sections";

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className={`h-3 w-3 shrink-0 fill-none stroke-current stroke-2 transition-transform duration-150 ${
        collapsed ? "-rotate-90" : ""
      }`}
    >
      <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Must be a descendant of the Link it reports on — useLinkStatus only
// reflects pending state for the nearest enclosing <Link>. Portals to
// document.body rather than relying on `position: fixed` in place, since
// the mobile drawer slides using a transform, and a transformed ancestor
// would otherwise turn "fixed" into "positioned relative to the drawer"
// instead of the viewport. Only shows once navigation has actually taken
// a moment — an already-prefetched route skips the pending state
// entirely, so a fast click never flashes it.
function NavLinkOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/70 backdrop-blur-[1px]"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>,
    document.body,
  );
}

type NavItem = { href: string; label: string };
type NavGroup = { heading?: string; items: NavItem[] };

const OVERVIEW_ITEM: NavItem = { href: "/dashboard", label: "Overview" };
const EMPLOYEE_OVERVIEW_ITEM: NavItem = { href: "/me", label: "Overview" };
const PAYSLIPS_NAV_ITEM: NavItem = { href: "/me/payslips", label: "Payslips" };

const WORKFORCE_ITEMS: NavItem[] = [
  { href: "/employees", label: "Employees" },
  { href: "/departments", label: "Departments" },
  { href: "/branches", label: "Branches" },
  { href: "/job-grades", label: "Job Grades" },
  { href: "/org-chart", label: "Org Chart" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/employee-relations", label: "Employee Relations" },
];

const PAYROLL_ITEMS: NavItem[] = [
  { href: "/payroll", label: "Payroll Runs" },
  { href: "/compliance", label: "Compliance Engine" },
  { href: "/settlements", label: "Final Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/simulation", label: "Payroll Simulation" },
  { href: "/vendors", label: "Vendors" },
  { href: "/bills", label: "Bills (AP)" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices (AR)" },
  { href: "/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/general-ledger", label: "General Ledger" },
  { href: "/financial-statements", label: "Financial Statements" },
  { href: "/bank-reconciliation", label: "Bank Reconciliation" },
  { href: "/fixed-assets", label: "Fixed Assets" },
  { href: "/fixed-assets/depreciation", label: "Depreciation Runs" },
  { href: "/budgets", label: "Budgets" },
];

const REQUESTS_ITEMS: NavItem[] = [
  { href: "/loans", label: "Loans & Advances" },
  { href: "/expenses", label: "Expenses" },
  { href: "/leave", label: "Leave & Attendance" },
  { href: "/attendance", label: "Attendance" },
  { href: "/shifts", label: "Shift Schedule" },
  { href: "/overtime", label: "Overtime" },
  { href: "/benefits", label: "Benefits" },
];

const COMPANY_ITEMS: NavItem[] = [
  { href: "/policies", label: "Company Policies" },
  { href: "/notifications", label: "Notifications" },
];

const TOOLS_ITEMS: NavItem[] = [
  { href: "/", label: "PAYE Calculator" },
  { href: "/featuremap", label: "Full Feature Map" },
];

const MANAGER_NAV_ITEM: NavItem = { href: "/team", label: "My Team" };
const SECURITY_NAV_ITEM: NavItem = { href: "/security", label: "Security & Access" };
const INTEGRATIONS_NAV_ITEM: NavItem = { href: "/integrations", label: "Integrations" };
const AUDIT_LOG_NAV_ITEM: NavItem = { href: "/security/audit-log", label: "Audit Log" };
const PERFORMANCE_NAV_ITEM: NavItem = { href: "/performance", label: "Performance" };
const EMPLOYEE_RELATIONS_NAV_ITEM: NavItem = { href: "/employee-relations", label: "Employee Relations" };

export function SidebarNav({
  role,
  sections,
  isManager = false,
  unreadNotifications = 0,
}: {
  role?: string;
  sections: SectionKey[];
  isManager?: boolean;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const has = (section: SectionKey) => sections.includes(section);

  // Everything starts expanded, same as before this feature existed.
  // Next.js keeps this layout mounted across client-side navigation, so
  // collapse state survives moving between pages within the session — it
  // just doesn't survive a full reload, which is a fine trade for not
  // needing to sync with localStorage on every render.
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(new Set());

  function toggleGroup(heading: string) {
    setCollapsedHeadings((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) {
        next.delete(heading);
      } else {
        next.add(heading);
      }
      return next;
    });
  }

  const groups: NavGroup[] = [{ items: [role === "employee" ? EMPLOYEE_OVERVIEW_ITEM : OVERVIEW_ITEM] }];

  // Same tier as Overview, not folded into a "Payslips" heading — this is
  // one link, and every other role reaches payslips through Payroll Runs
  // instead, so it's tied to the employee-self-service nav shape the same
  // way EMPLOYEE_OVERVIEW_ITEM already is, not to a broader section.
  if (role === "employee") {
    groups.push({ items: [PAYSLIPS_NAV_ITEM] });
  }

  // Goals and appraisals are self-service for everyone (an employee sets
  // their own goals and acknowledges their own appraisal), and RLS scopes
  // what a manager/admin/hr_manager additionally sees — so this link stays
  // outside the section system entirely, alongside Overview and Tools,
  // rather than tied to any one role's default sections.
  groups.push({ heading: "Performance", items: [PERFORMANCE_NAV_ITEM] });

  if (has("workforce")) {
    groups.push({
      heading: "Workforce",
      items: isManager ? [...WORKFORCE_ITEMS, MANAGER_NAV_ITEM] : WORKFORCE_ITEMS,
    });
  } else if (isManager) {
    groups.push({ heading: "Team", items: [MANAGER_NAV_ITEM] });
  } else if (role === "legal_compliance") {
    // Legal & Compliance has RLS read access to employee relations cases
    // but doesn't get the broader "workforce" section (recruitment,
    // departments, etc. aren't its territory) — same shape as Team above,
    // one targeted link rather than the whole section.
    groups.push({ heading: "Employee Relations", items: [EMPLOYEE_RELATIONS_NAV_ITEM] });
  }

  if (has("payroll")) {
    groups.push({ heading: "Payroll", items: PAYROLL_ITEMS });
  }

  if (has("requests")) {
    groups.push({ heading: "Requests", items: REQUESTS_ITEMS });
  }

  if (has("company")) {
    // Security & Access (and Integrations alongside it) stays tied to the
    // actual admin role, not the per-user section toggle — granting it to
    // anyone else would only show a link that redirects them straight back
    // out, since the page itself checks role, not this nav. Audit Log is
    // its own link rather than folded into Security & Access, since an
    // auditor can reach that page (read-only) without the member-management
    // page it normally lives under.
    let companyItems = COMPANY_ITEMS;
    if (role === "admin") {
      companyItems = [...COMPANY_ITEMS, INTEGRATIONS_NAV_ITEM, SECURITY_NAV_ITEM, AUDIT_LOG_NAV_ITEM];
    } else if (role === "auditor" || role === "finance_manager" || role === "legal_compliance") {
      companyItems = [...COMPANY_ITEMS, AUDIT_LOG_NAV_ITEM];
    }
    groups.push({ heading: "Company", items: companyItems });
  }

  groups.push({ heading: "Tools", items: TOOLS_ITEMS });

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group, i) => {
        const groupHasActive = group.items.some(
          (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
        );
        // A manually collapsed group still opens back up while the active
        // page lives inside it — losing sight of where you are would be a
        // worse trade than the collapse preference holding perfectly.
        const isCollapsed = Boolean(group.heading) && collapsedHeadings.has(group.heading!) && !groupHasActive;

        return (
          <div key={group.heading ?? i} className="flex flex-col gap-1">
            {group.heading ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.heading!)}
                aria-expanded={!isCollapsed}
                className="flex items-center justify-between rounded-control px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.03em] text-primary-tint/60 hover:text-primary-tint"
              >
                <span>{group.heading}</span>
                <ChevronIcon collapsed={isCollapsed} />
              </button>
            ) : null}
            {!isCollapsed &&
              group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-control px-3 py-2 text-[13px] font-bold ${
                      active ? "bg-primary text-white" : "text-primary-tint hover:bg-primary"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.href === "/notifications" && unreadNotifications > 0 && (
                      <span className="rounded-badge bg-white px-[7px] py-[1px] text-[11px] font-extrabold text-primary-dark">
                        {unreadNotifications}
                      </span>
                    )}
                    <NavLinkOverlay />
                  </Link>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
