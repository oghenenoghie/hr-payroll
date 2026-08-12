// Single source of truth for role display labels — previously duplicated
// (and drifted out of sync) between AppShell.tsx and TopBar.tsx.
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  accountant: "Accountant",
  department_manager: "Department Manager",
  employee: "Employee",
  auditor: "Auditor",
  compensation_benefits_manager: "Compensation & Benefits Manager",
  finance_manager: "Finance Manager / CFO",
  chro: "CHRO",
  legal_compliance: "Legal & Compliance",
};

// Roles /dashboard's widget system actually covers — "employee" uses a
// structurally different page (/me), never /dashboard, so it's excluded
// from anything role-preview/widget-visibility related to that page.
export const DASHBOARD_ROLES = Object.keys(ROLE_LABEL).filter((role) => role !== "employee");
