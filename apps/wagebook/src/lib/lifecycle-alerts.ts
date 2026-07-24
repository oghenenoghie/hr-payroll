import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";
import { createAdminClient } from "./supabase/admin";
import { getOrgRoleUserIds, notifyUsers } from "./notifications";

// Matches getContractStatus/getProbationStatus's "ends soon" threshold in
// lib/format.ts, so a notification fires at the same point the employee
// directory badge would first flip to "Ends soon" — not a separately
// invented window.
const REMINDER_WINDOW_DAYS = 14;

/**
 * Notifies admin/hr_manager once per approaching contract-expiry or
 * probation-ending deadline, computed on page load since this app has no
 * background job runner. Idempotent via the *_notified_at columns on
 * employees, which a database trigger resets whenever the underlying date
 * changes (see 20260724070000_lifecycle_alerts.sql), so extending a
 * contract or probation date re-arms the alert for the new date.
 */
export async function notifyLifecycleDeadlines(supabase: SupabaseClient<Database>, orgId: string): Promise<void> {
  const recipientUserIds = await getOrgRoleUserIds(supabase, orgId, ["admin", "hr_manager"]);
  if (recipientUserIds.length === 0) return;

  const windowDate = new Date(Date.now() + REMINDER_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  // Marking notified needs the service-role client: a payroll_manager can
  // also load the employees list page (this check's only trigger point)
  // but has no UPDATE right on the employees table (see
  // 20260722162724_payroll_core.sql's "admins and HR can update employees"
  // policy) — without this, their page load would find the same
  // candidates every time and notify repeatedly instead of once.
  const admin = createAdminClient();

  const { data: contractCandidates } = await supabase
    .from("employees")
    .select("id, full_name, contract_end_date")
    .eq("org_id", orgId)
    .eq("status", "active")
    .neq("employment_type", "permanent")
    .not("contract_end_date", "is", null)
    .lte("contract_end_date", windowDate)
    .is("contract_expiry_notified_at", null);

  for (const employee of contractCandidates ?? []) {
    await notifyUsers(supabase, {
      orgId,
      recipientUserIds,
      type: "contract_expiring",
      message: `${employee.full_name}'s contract ends ${employee.contract_end_date} — renew or process termination.`,
      link: `/employees/${employee.id}/edit`,
    });
    await admin.from("employees").update({ contract_expiry_notified_at: new Date().toISOString() }).eq("id", employee.id);
  }

  const { data: probationCandidates } = await supabase
    .from("employees")
    .select("id, full_name, probation_end_date")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("confirmed", false)
    .not("probation_end_date", "is", null)
    .lte("probation_end_date", windowDate)
    .is("probation_expiry_notified_at", null);

  for (const employee of probationCandidates ?? []) {
    await notifyUsers(supabase, {
      orgId,
      recipientUserIds,
      type: "probation_ending",
      message: `${employee.full_name}'s probation ends ${employee.probation_end_date} — confirm or extend.`,
      link: `/employees/${employee.id}/edit`,
    });
    await admin.from("employees").update({ probation_expiry_notified_at: new Date().toISOString() }).eq("id", employee.id);
  }
}
