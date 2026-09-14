"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { SectionKey } from "@/lib/nav-sections";
import {
  GridIcon,
  ReceiptIcon,
  TargetIcon,
  CapIcon,
  PeopleIcon,
  BuildingIcon,
  LayersIcon,
  HierarchyIcon,
  BriefcaseIcon,
  ShieldIcon,
  BanknoteIcon,
  DoorExitIcon,
  BarChartIcon,
  SlidersIcon,
  TruckIcon,
  PersonCardIcon,
  ListIcon,
  BookIcon,
  ColumnsIcon,
  BoxIcon,
  TrendDownIcon,
  PieChartIcon,
  CoinsIcon,
  CalendarIcon,
  ClockIcon,
  HeartIcon,
  BellIcon,
  CalculatorIcon,
  MapIcon,
  PlugIcon,
  HistoryIcon,
} from "@/components/icons";

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

export type NavIcon = React.ComponentType<{ className?: string }>;
export type NavItem = { href: string; label: string; icon: NavIcon };
// A group is either a flat list of items, or split into subgroups when
// it's big enough that a flat list would be a wall of items (currently
// only HR and Accounts) — never both on the same group.
export type NavSubgroup = { heading: string; items: NavItem[] };
export type NavGroup = { heading?: string; items?: NavItem[]; subgroups?: NavSubgroup[] };

// Every item across every group/subgroup of a NavGroup, in order —
// consumers that don't care about the grouping (e.g. AppShell's page-title
// lookup) use this instead of duplicating the items-vs-subgroups branch.
export function flattenNavGroup(group: NavGroup): NavItem[] {
  return group.subgroups ? group.subgroups.flatMap((subgroup) => subgroup.items) : (group.items ?? []);
}

const OVERVIEW_ITEM: NavItem = { href: "/dashboard", label: "Overview", icon: GridIcon };
const EMPLOYEE_OVERVIEW_ITEM: NavItem = { href: "/me", label: "Overview", icon: GridIcon };
const PAYSLIPS_NAV_ITEM: NavItem = { href: "/me/payslips", label: "Payslips", icon: ReceiptIcon };

const WORKFORCE_ITEMS: NavItem[] = [
  { href: "/employees", label: "Employees", icon: PeopleIcon },
  { href: "/departments", label: "Departments", icon: BuildingIcon },
  { href: "/branches", label: "Branches", icon: BuildingIcon },
  { href: "/job-grades", label: "Job Grades", icon: LayersIcon },
  { href: "/org-chart", label: "Org Chart", icon: HierarchyIcon },
  { href: "/recruitment", label: "Recruitment", icon: BriefcaseIcon },
  { href: "/employee-relations", label: "Employee Relations", icon: ShieldIcon },
];

// Split into subgroups (below) rather than one flat 16-item list under
// "Accounts" — Payroll, Payables & Receivables, Accounting, and Assets &
// Budgets are distinct sub-domains that happened to share one "payroll"
// section gate; the gate stays the same, only the rendering is chunked.
const ACCOUNTS_PAYROLL_ITEMS: NavItem[] = [
  { href: "/payroll", label: "Payroll Runs", icon: BanknoteIcon },
  { href: "/compliance", label: "Compliance Engine", icon: ShieldIcon },
  { href: "/settlements", label: "Final Settlement", icon: DoorExitIcon },
  { href: "/reports", label: "Reports", icon: BarChartIcon },
  { href: "/simulation", label: "Payroll Simulation", icon: SlidersIcon },
];

const ACCOUNTS_PAYABLES_RECEIVABLES_ITEMS: NavItem[] = [
  { href: "/vendors", label: "Vendors", icon: TruckIcon },
  { href: "/bills", label: "Bills (AP)", icon: ReceiptIcon },
  { href: "/customers", label: "Customers", icon: PersonCardIcon },
  { href: "/invoices", label: "Invoices (AR)", icon: ReceiptIcon },
];

const ACCOUNTS_ACCOUNTING_ITEMS: NavItem[] = [
  { href: "/chart-of-accounts", label: "Chart of Accounts", icon: ListIcon },
  { href: "/general-ledger", label: "General Ledger", icon: BookIcon },
  { href: "/financial-statements", label: "Financial Statements", icon: BarChartIcon },
  { href: "/bank-reconciliation", label: "Bank Reconciliation", icon: ColumnsIcon },
];

const ACCOUNTS_ASSETS_BUDGETS_ITEMS: NavItem[] = [
  { href: "/fixed-assets", label: "Fixed Assets", icon: BoxIcon },
  { href: "/fixed-assets/depreciation", label: "Depreciation Runs", icon: TrendDownIcon },
  { href: "/budgets", label: "Budgets", icon: PieChartIcon },
];

const REQUESTS_ITEMS: NavItem[] = [
  { href: "/loans", label: "Loans & Advances", icon: CoinsIcon },
  { href: "/expenses", label: "Expenses", icon: ReceiptIcon },
  { href: "/leave", label: "Leave & Attendance", icon: CalendarIcon },
  { href: "/attendance", label: "Attendance", icon: ClockIcon },
  { href: "/shifts", label: "Shift Schedule", icon: CalendarIcon },
  { href: "/overtime", label: "Overtime", icon: ClockIcon },
  { href: "/benefits", label: "Benefits", icon: HeartIcon },
  { href: "/union-dues", label: "Union Dues", icon: CoinsIcon },
];

const COMPANY_ITEMS: NavItem[] = [
  { href: "/policies", label: "Company Policies", icon: BookIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
];

const TOOLS_ITEMS: NavItem[] = [
  { href: "/", label: "PAYE Calculator", icon: CalculatorIcon },
  { href: "/featuremap", label: "Full Feature Map", icon: MapIcon },
];

const MANAGER_NAV_ITEM: NavItem = { href: "/team", label: "My Team", icon: PeopleIcon };
const SECURITY_NAV_ITEM: NavItem = { href: "/security", label: "Security & Access", icon: ShieldIcon };
const INTEGRATIONS_NAV_ITEM: NavItem = { href: "/integrations", label: "Integrations", icon: PlugIcon };
const AUDIT_LOG_NAV_ITEM: NavItem = { href: "/security/audit-log", label: "Audit Log", icon: HistoryIcon };
const PERFORMANCE_NAV_ITEM: NavItem = { href: "/performance", label: "Performance", icon: TargetIcon };
const EMPLOYEE_RELATIONS_NAV_ITEM: NavItem = { href: "/employee-relations", label: "Employee Relations", icon: ShieldIcon };
const LEARNING_NAV_ITEM: NavItem = { href: "/learning", label: "Learning", icon: CapIcon };
const BILLING_NAV_ITEM: NavItem = { href: "/billing", label: "Billing & Subscription", icon: BanknoteIcon };
const WORKFLOWS_NAV_ITEM: NavItem = { href: "/workflows", label: "Approval Workflows", icon: SlidersIcon };

// Department Manager has no "workforce" section (dept-scoped, not free
// rein over Branches/Job Grades/Recruitment) but RLS still scopes them
// to their own department's employees and org-chart entry via
// core.is_department_manager_of() — give them narrow direct links
// instead of the full Workforce section.
const DEPARTMENT_MANAGER_WORKFORCE_ITEMS: NavItem[] = [
  { href: "/employees", label: "Employees", icon: PeopleIcon },
  { href: "/org-chart", label: "Org Chart", icon: HierarchyIcon },
];

// Pure — no hooks, no pathname dependency — so it can be called both from
// this component's render and from AppShell (to derive the current page's
// section title for the desktop top bar) without duplicating the role/
// section logic in two places.
export function buildNavGroups(role: string | undefined, sections: SectionKey[], isManager: boolean): NavGroup[] {
  const has = (section: SectionKey) => sections.includes(section);
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

  // HR groups the former standalone "Workforce" and "Requests" headings
  // under one heading, plus Learning (previously always visible to every
  // role, now gated the same way Workforce/Requests already were — a role
  // with neither section no longer sees it). The two sections still toggle
  // independently in Security & Access; this only changes how they render
  // together, not who has them. My Team is appended whenever the viewer is
  // a manager, matching the pre-reorg behavior of showing it either inside
  // Workforce or, for a manager without the workforce section (e.g. a
  // department manager), as its own fallback below.
  //
  // Split into subgroups rather than one flat list of up to 16 items —
  // Workforce and Requests & Time still toggle independently in Security
  // & Access, this only changes how they render together.
  const hasHr = has("workforce") || has("requests") || role === "department_manager";
  if (hasHr) {
    const hrSubgroups: NavSubgroup[] = [];
    if (has("workforce")) {
      hrSubgroups.push({ heading: "Workforce", items: WORKFORCE_ITEMS });
    } else if (role === "department_manager") {
      // No "workforce" section by default (scoped to their own
      // department, not free rein over Branches/Job Grades/
      // Recruitment/other departments) — narrow direct links instead,
      // RLS-scoped by core.is_department_manager_of().
      hrSubgroups.push({ heading: "Workforce", items: DEPARTMENT_MANAGER_WORKFORCE_ITEMS });
    }
    if (has("requests")) hrSubgroups.push({ heading: "Requests & Time", items: REQUESTS_ITEMS });
    const companyItems = [LEARNING_NAV_ITEM, ...(isManager ? [MANAGER_NAV_ITEM] : [])];
    hrSubgroups.push({ heading: "Company", items: companyItems });
    groups.push({ heading: "HR", subgroups: hrSubgroups });
  } else if (isManager) {
    groups.push({ heading: "Team", items: [MANAGER_NAV_ITEM] });
  } else if (role === "legal_compliance") {
    // Legal & Compliance has RLS read access to employee relations cases
    // but doesn't get the broader HR section (recruitment, departments,
    // leave, etc. aren't its territory) — same shape as Team above, one
    // targeted link rather than the whole section.
    groups.push({ heading: "Employee Relations", items: [EMPLOYEE_RELATIONS_NAV_ITEM] });
  }

  // Accounts is the former "Payroll" heading, renamed — same items
  // (Payroll Runs through Budgets, including Vendors/Bills/Customers/
  // Invoices together) and same "payroll" section gate, just relabeled to
  // match the finance-and-accounting shape those items actually have, and
  // split into subgroups so the whole finance/accounting surface lives
  // under this one heading without being a 16-item wall.
  if (has("payroll")) {
    groups.push({
      heading: "Accounts",
      subgroups: [
        { heading: "Payroll", items: ACCOUNTS_PAYROLL_ITEMS },
        { heading: "Payables & Receivables", items: ACCOUNTS_PAYABLES_RECEIVABLES_ITEMS },
        { heading: "Accounting", items: ACCOUNTS_ACCOUNTING_ITEMS },
        { heading: "Assets & Budgets", items: ACCOUNTS_ASSETS_BUDGETS_ITEMS },
      ],
    });
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
      companyItems = [
        ...COMPANY_ITEMS,
        INTEGRATIONS_NAV_ITEM,
        BILLING_NAV_ITEM,
        WORKFLOWS_NAV_ITEM,
        SECURITY_NAV_ITEM,
        AUDIT_LOG_NAV_ITEM,
      ];
    } else if (role === "auditor" || role === "finance_manager" || role === "legal_compliance") {
      companyItems = [...COMPANY_ITEMS, AUDIT_LOG_NAV_ITEM];
    }
    groups.push({ heading: "Company Info", items: companyItems });
  }

  groups.push({ heading: "Tools", items: TOOLS_ITEMS });

  return groups;
}

function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemsHaveActive(items: NavItem[], pathname: string): boolean {
  return items.some((item) => isActiveHref(pathname, item.href));
}

function groupHasActive(group: NavGroup, pathname: string): boolean {
  return itemsHaveActive(flattenNavGroup(group), pathname);
}

// Every heading collapsed except whichever one contains the current page —
// a role with several sections (admin, payroll_manager, auditor) would
// otherwise see all four groups, and every HR/Accounts subgroup, expanded
// on first load.
function initialCollapsed(groups: NavGroup[], pathname: string): Set<string> {
  const collapsed = new Set<string>();
  for (const group of groups) {
    if (group.heading && !groupHasActive(group, pathname)) collapsed.add(group.heading);
    if (group.subgroups) {
      for (const subgroup of group.subgroups) {
        if (!itemsHaveActive(subgroup.items, pathname)) collapsed.add(`${group.heading}/${subgroup.heading}`);
      }
    }
  }
  return collapsed;
}

function NavItemRow({ item, active, unreadNotifications }: { item: NavItem; active: boolean; unreadNotifications: number }) {
  const ItemIcon = item.icon;
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-bold ${
        active ? "text-white" : "text-primary-tint hover:bg-primary"
      }`}
    >
      {active && (
        <motion.span
          layoutId="active-nav-pill"
          className="absolute inset-0 rounded-control bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <ItemIcon className="relative h-4 w-4 shrink-0" />
      <span className="relative flex-1">{item.label}</span>
      {item.href === "/notifications" && unreadNotifications > 0 && (
        <span className="relative rounded-badge bg-primary-tint px-[7px] py-[1px] text-[11px] font-extrabold text-primary-dark">
          {unreadNotifications}
        </span>
      )}
      <NavLinkOverlay />
    </Link>
  );
}

function CollapsibleItems({ items, pathname, unreadNotifications }: { items: NavItem[]; pathname: string; unreadNotifications: number }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex flex-col gap-1 overflow-hidden"
    >
      {items.map((item) => (
        <NavItemRow
          key={item.href}
          item={item}
          active={isActiveHref(pathname, item.href)}
          unreadNotifications={unreadNotifications}
        />
      ))}
    </motion.div>
  );
}

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
  const groups = buildNavGroups(role, sections, isManager);

  // Next.js keeps this layout mounted across client-side navigation, so
  // collapse state survives moving between pages within the session — it
  // just doesn't survive a full reload, which is a fine trade for not
  // needing to sync with localStorage on every render.
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(() => initialCollapsed(groups, pathname));

  function toggleGroup(key: string) {
    setCollapsedHeadings((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group, i) => {
        const hasActive = groupHasActive(group, pathname);
        // A manually collapsed group still opens back up while the active
        // page lives inside it — losing sight of where you are would be a
        // worse trade than the collapse preference holding perfectly.
        const isCollapsed = Boolean(group.heading) && collapsedHeadings.has(group.heading!) && !hasActive;

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
            <AnimatePresence initial={false}>
              {!isCollapsed &&
                (group.subgroups ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex flex-col gap-1 overflow-hidden pl-2"
                  >
                    {group.subgroups.map((subgroup) => {
                      const subKey = `${group.heading}/${subgroup.heading}`;
                      const subHasActive = itemsHaveActive(subgroup.items, pathname);
                      const subCollapsed = collapsedHeadings.has(subKey) && !subHasActive;
                      return (
                        <div key={subKey} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => toggleGroup(subKey)}
                            aria-expanded={!subCollapsed}
                            className="flex items-center justify-between rounded-control px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.03em] text-primary-tint/50 hover:text-primary-tint"
                          >
                            <span>{subgroup.heading}</span>
                            <ChevronIcon collapsed={subCollapsed} />
                          </button>
                          <AnimatePresence initial={false}>
                            {!subCollapsed && (
                              <CollapsibleItems
                                items={subgroup.items}
                                pathname={pathname}
                                unreadNotifications={unreadNotifications}
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <CollapsibleItems
                    items={group.items ?? []}
                    pathname={pathname}
                    unreadNotifications={unreadNotifications}
                  />
                ))}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
