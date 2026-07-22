"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/payroll", label: "Payroll Runs" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
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
