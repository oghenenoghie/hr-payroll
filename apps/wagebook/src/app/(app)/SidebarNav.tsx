"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { SectionKey } from "@/lib/nav-sections";

// Must be a descendant of the Link it reports on — useLinkStatus only
// reflects pending state for the nearest enclosing <Link>. Reserves its
// own space (rather than popping in) so a fast, already-prefetched
// navigation never causes a layout shift; only shows once navigation has
// actually taken a moment, for a route that's dynamic and has no
// loading.tsx of its own to fall back on.
function NavLinkSpinner() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-2 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent transition-opacity duration-150 ${
        pending ? "opacity-70" : "opacity-0"
      }`}
    />
  );
}

type NavItem = { href: string; label: string };
type NavGroup = { heading?: string; items: NavItem[] };

const OVERVIEW_ITEM: NavItem = { href: "/dashboard", label: "Overview" };
const EMPLOYEE_OVERVIEW_ITEM: NavItem = { href: "/me", label: "Overview" };

const WORKFORCE_ITEMS: NavItem[] = [
  { href: "/employees", label: "Employees" },
  { href: "/departments", label: "Departments" },
  { href: "/branches", label: "Branches" },
  { href: "/job-grades", label: "Job Grades" },
  { href: "/org-chart", label: "Org Chart" },
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

  const groups: NavGroup[] = [{ items: [role === "employee" ? EMPLOYEE_OVERVIEW_ITEM : OVERVIEW_ITEM] }];

  if (has("workforce")) {
    groups.push({
      heading: "Workforce",
      items: isManager ? [...WORKFORCE_ITEMS, MANAGER_NAV_ITEM] : WORKFORCE_ITEMS,
    });
  } else if (isManager) {
    groups.push({ heading: "Team", items: [MANAGER_NAV_ITEM] });
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
    // out, since the page itself checks role, not this nav.
    const companyItems = role === "admin" ? [...COMPANY_ITEMS, INTEGRATIONS_NAV_ITEM, SECURITY_NAV_ITEM] : COMPANY_ITEMS;
    groups.push({ heading: "Company", items: companyItems });
  }

  groups.push({ heading: "Tools", items: TOOLS_ITEMS });

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group, i) => (
        <div key={group.heading ?? i} className="flex flex-col gap-1">
          {group.heading && (
            <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.03em] text-primary-tint/60">
              {group.heading}
            </span>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-control px-3 py-2 text-[13px] font-bold ${
                  active ? "bg-primary text-white" : "text-primary-tint hover:bg-primary"
                }`}
              >
                <span className="flex items-center">
                  {item.label}
                  <NavLinkSpinner />
                </span>
                {item.href === "/notifications" && unreadNotifications > 0 && (
                  <span className="rounded-badge bg-white px-[7px] py-[1px] text-[11px] font-extrabold text-primary-dark">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
