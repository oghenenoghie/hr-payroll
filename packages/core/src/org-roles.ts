export const ORG_ROLES = ["admin", "payroll_manager", "hr_manager", "employee"] as const;

export type OrgRole = (typeof ORG_ROLES)[number];
