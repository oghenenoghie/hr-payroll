"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/payroll", label: "Payroll Runs" },
  { href: "/compliance", label: "Compliance Engine" },
  { href: "/loans", label: "Loans & Advances" },
  { href: "/expenses", label: "Expenses" },
  { href: "/leave", label: "Leave & Attendance" },
  { href: "/settlements", label: "Final Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/simulation", label: "Payroll Simulation" },
];

const EMPLOYEE_NAV_ITEMS = [{ href: "/me", label: "Overview" }];

export function SidebarNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const items = role === "employee" ? EMPLOYEE_NAV_ITEMS : ADMIN_NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-control px-3 py-2 text-[13px] font-bold ${
              active ? "bg-primary text-white" : "text-primary-tint hover:bg-primary"
            }`}
          >
            {item.label}
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
