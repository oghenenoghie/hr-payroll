import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

export type SectionKey = "workforce" | "payroll" | "requests" | "company";

export const ALL_SECTIONS: SectionKey[] = ["workforce", "payroll", "requests", "company"];

// Labels for the per-user access toggle (Security & Access), not the
// sidebar headings — the sidebar now groups workforce+requests under one
// "HR" heading and relabels payroll/company as "Accounts"/"Company Info"
// (see SidebarNav's buildNavGroups), but each key here still toggles
// independently, so the label spells out which sidebar group it feeds.
export const SECTION_LABELS: Record<SectionKey, string> = {
  workforce: "Workforce (HR)",
  payroll: "Accounts",
  requests: "Requests (HR)",
  company: "Company Info",
};

// What each role sees before any per-user override. Security & Access
// stays hardcoded to admin only in SidebarNav rather than living here —
// granting it to anyone else would just show a link that redirects them
// straight back out, since the page itself is admin-only regardless of
// what's toggled here.
const ROLE_DEFAULT_SECTIONS: Record<string, SectionKey[]> = {
  admin: ["workforce", "payroll", "requests", "company"],
  payroll_manager: ["workforce", "payroll", "requests", "company"],
  hr_manager: ["workforce", "requests", "company"],
  accountant: ["payroll"],
  department_manager: ["requests"],
  auditor: ["workforce", "payroll", "requests", "company"],
  compensation_benefits_manager: ["workforce", "requests"],
  finance_manager: ["payroll", "company"],
  chro: ["workforce", "requests", "company"],
  legal_compliance: ["company"],
  employee: [],
};

export function defaultSectionsForRole(role: string): SectionKey[] {
  return ROLE_DEFAULT_SECTIONS[role] ?? [];
}

// Resolves the sections one specific person sees: their role's defaults,
// with any per-user override on top (Security & Access -> a member's
// Access page). A missing override row for a section just means "use the
// role default" — the table only ever holds exceptions, never a full copy
// of everyone's access (see the migration).
//
// Nav-level only — this decides what shows in the sidebar, never what a
// page or server action allows. Every page keeps its own existing role
// check regardless of what's granted here.
export async function resolveNavSections(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  role: string,
): Promise<SectionKey[]> {
  const sections = new Set(defaultSectionsForRole(role));

  const { data: overrides } = await supabase
    .from("user_nav_overrides")
    .select("section_key, enabled")
    .eq("org_id", orgId)
    .eq("user_id", userId);

  for (const override of overrides ?? []) {
    if (override.enabled) {
      sections.add(override.section_key as SectionKey);
    } else {
      sections.delete(override.section_key as SectionKey);
    }
  }

  return ALL_SECTIONS.filter((section) => sections.has(section));
}
