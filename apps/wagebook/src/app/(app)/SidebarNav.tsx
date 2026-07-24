"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavGroup = { heading?: string; items: NavItem[] };

const OVERVIEW_ITEM: NavItem = { href: "/dashboard", label: "Overview" };

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

const EMPLOYEE_NAV_ITEMS: NavItem[] = [{ href: "/me", label: "Overview" }];

function buildAdminGroups(isManager: boolean, isAdmin: boolean): NavGroup[] {
  const workforce = isManager ? [...WORKFORCE_ITEMS, MANAGER_NAV_ITEM] : WORKFORCE_ITEMS;
  const company = isAdmin ? [...COMPANY_ITEMS, INTEGRATIONS_NAV_ITEM, SECURITY_NAV_ITEM] : COMPANY_ITEMS;

  return [
    { items: [OVERVIEW_ITEM] },
    { heading: "Workforce", items: workforce },
    { heading: "Payroll", items: PAYROLL_ITEMS },
    { heading: "Requests", items: REQUESTS_ITEMS },
    { heading: "Company", items: company },
    { heading: "Tools", items: TOOLS_ITEMS },
  ];
}

export function SidebarNav({
  role,
  isManager = false,
  unreadNotifications = 0,
}: {
  role?: string;
  isManager?: boolean;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] =
    role === "employee" ? [{ items: EMPLOYEE_NAV_ITEMS }] : buildAdminGroups(isManager, role === "admin");

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
                <span>{item.label}</span>
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
