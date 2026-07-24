"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/departments", label: "Departments" },
  { href: "/branches", label: "Branches" },
  { href: "/job-grades", label: "Job Grades" },
  { href: "/org-chart", label: "Org Chart" },
  { href: "/payroll", label: "Payroll Runs" },
  { href: "/compliance", label: "Compliance Engine" },
  { href: "/loans", label: "Loans & Advances" },
  { href: "/expenses", label: "Expenses" },
  { href: "/leave", label: "Leave & Attendance" },
  { href: "/attendance", label: "Attendance" },
  { href: "/overtime", label: "Overtime" },
  { href: "/benefits", label: "Benefits" },
  { href: "/policies", label: "Company Policies" },
  { href: "/settlements", label: "Final Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/simulation", label: "Payroll Simulation" },
  { href: "/notifications", label: "Notifications" },
  { href: "/featuremap", label: "Full Feature Map" },
];

const EMPLOYEE_NAV_ITEMS = [{ href: "/me", label: "Overview" }];

const MANAGER_NAV_ITEM = { href: "/team", label: "My Team" };
const SECURITY_NAV_ITEM = { href: "/security", label: "Security & Access" };
const INTEGRATIONS_NAV_ITEM = { href: "/integrations", label: "Integrations" };

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
  const baseItems = role === "employee" ? EMPLOYEE_NAV_ITEMS : ADMIN_NAV_ITEMS;
  const withManager = isManager ? [...baseItems, MANAGER_NAV_ITEM] : baseItems;
  const items = role === "admin" ? [...withManager, INTEGRATIONS_NAV_ITEM, SECURITY_NAV_ITEM] : withManager;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
      <Link
        href="/"
        className="rounded-control px-3 py-2 text-[13px] font-bold text-primary-tint hover:bg-primary"
      >
        PAYE Calculator
      </Link>
    </nav>
  );
}
