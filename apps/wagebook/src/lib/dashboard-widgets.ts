// Dashboard widget catalog — same shape and purpose as MODULES in
// feature-modules.ts, but for /dashboard instead of /featuremap.
// defaultRoles is what a widget shows to when the org has never touched
// /security/dashboards for it; an admin override in
// dashboard_widget_visibility replaces that set entirely for that widget,
// the same "zero rows = default, any rows = authoritative" shape
// module_role_visibility already established — the only difference is
// module_role_visibility's default is "everyone" (a reference page, safe
// to leave wide open) where a dashboard widget's default is deliberately
// narrow, since not every widget makes sense for every role.
export type DashboardWidget = {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
};

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    key: "org_snapshot",
    label: "Organization",
    description: "Org name, pay frequency, states of operation.",
    defaultRoles: [
      "admin",
      "payroll_manager",
      "hr_manager",
      "accountant",
      "department_manager",
      "auditor",
      "compensation_benefits_manager",
      "finance_manager",
      "chro",
      "legal_compliance",
    ],
  },
  {
    key: "pending_approvals",
    label: "Pending approvals",
    description: "Leave, loans, expenses and overtime awaiting a decision.",
    defaultRoles: ["admin", "payroll_manager", "hr_manager", "department_manager"],
  },
  {
    key: "payroll_snapshot",
    label: "Payroll",
    description: "The most recent pay run and its totals.",
    defaultRoles: ["admin", "payroll_manager", "finance_manager"],
  },
  {
    key: "workforce_snapshot",
    label: "Workforce",
    description: "Active headcount and contract/probation deadlines coming up.",
    defaultRoles: ["admin", "hr_manager", "department_manager", "chro"],
  },
  {
    key: "compliance_audit",
    label: "Compliance & audit",
    description: "Recent authentication audit activity for the org.",
    defaultRoles: ["admin", "auditor", "finance_manager", "legal_compliance"],
  },
  {
    key: "accounts_snapshot",
    label: "Accounts payable & receivable",
    description: "Bills awaiting payment, invoices awaiting collection.",
    defaultRoles: ["admin", "payroll_manager", "accountant", "finance_manager"],
  },
  {
    key: "vat_wht_liability",
    label: "VAT & WHT liability",
    description: "VAT and WHT withheld on paid vendor bills, awaiting remittance to FIRS/NRS.",
    defaultRoles: ["admin", "payroll_manager", "accountant", "finance_manager", "legal_compliance"],
  },
  {
    key: "budget_snapshot",
    label: "Budgets",
    description: "Active budgets for the current period.",
    defaultRoles: ["admin", "finance_manager"],
  },
  {
    key: "compensation_snapshot",
    label: "Compensation & benefits",
    description: "Job grades, benefit plans and active enrollments.",
    defaultRoles: ["admin", "compensation_benefits_manager", "hr_manager", "chro"],
  },
  {
    key: "recruitment_snapshot",
    label: "Recruitment",
    description: "Open requisitions, candidates in the pipeline, upcoming interviews.",
    defaultRoles: ["admin", "hr_manager", "chro"],
  },
  {
    key: "performance_snapshot",
    label: "Performance management",
    description: "The active review cycle, goals in progress, appraisals awaiting acknowledgement.",
    defaultRoles: ["admin", "hr_manager", "chro"],
  },
  {
    key: "learning_snapshot",
    label: "Learning & development",
    description: "Assigned training in progress, mandatory training outstanding, and completed courses.",
    defaultRoles: ["admin", "hr_manager", "department_manager", "chro"],
  },
  {
    key: "my_team_snapshot",
    label: "My department",
    description: "Department roster size and pending leave for a department manager's own department.",
    defaultRoles: ["department_manager"],
  },
  {
    key: "compliance_deadlines",
    label: "Upcoming filings",
    description: "Next PAYE, NSITF, WHT/VAT and ITF filing deadlines, plus active employees missing a TIN.",
    defaultRoles: ["admin", "payroll_manager", "accountant", "finance_manager"],
  },
  {
    key: "org_kpi_snapshot",
    label: "Organization KPIs",
    description: "Total employees, new hires, pending approvals and TIN-missing counts as a KPI strip.",
    defaultRoles: [
      "admin",
      "payroll_manager",
      "hr_manager",
      "accountant",
      "auditor",
      "finance_manager",
      "chro",
    ],
  },
  {
    key: "approvals_breakdown",
    label: "Approvals breakdown",
    description: "A donut chart of approved, pending and rejected requests across loans, expenses, overtime and leave.",
    defaultRoles: ["admin", "payroll_manager", "hr_manager", "department_manager"],
  },
  {
    key: "payroll_cost_trend",
    label: "Payroll cost trend",
    description: "Net pay across the last 6 months, charted.",
    defaultRoles: ["admin", "payroll_manager", "finance_manager"],
  },
  {
    key: "recent_pay_runs",
    label: "Recent pay runs",
    description: "The 5 most recent pay runs with status and net pay.",
    defaultRoles: ["admin", "payroll_manager", "finance_manager"],
  },
  {
    key: "employee_directory",
    label: "Employee directory",
    description: "A quick-glance list of recently added employees.",
    defaultRoles: ["admin", "hr_manager", "department_manager", "chro"],
  },
];
