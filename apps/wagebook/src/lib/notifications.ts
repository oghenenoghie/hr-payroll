import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

export type NotificationType =
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "loan_request_submitted"
  | "loan_approved"
  | "loan_rejected"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "benefit_enrolled"
  | "pay_run_created"
  | "overtime_request_submitted"
  | "overtime_approved"
  | "overtime_rejected";

// Fire-and-forget: a notification is a side effect of an already-authorized
// action, never the thing being authorized, so a failed insert here should
// never surface as an error to the user performing the real action.
export async function notifyUsers(
  supabase: SupabaseClient<Database>,
  params: { orgId: string; recipientUserIds: string[]; type: NotificationType; message: string; link?: string },
) {
  const recipients = [...new Set(params.recipientUserIds)];
  if (recipients.length === 0) return;

  await supabase.from("notifications").insert(
    recipients.map((recipientUserId) => ({
      org_id: params.orgId,
      recipient_user_id: recipientUserId,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
    })),
  );
}

export async function getOrgRoleUserIds(
  supabase: SupabaseClient<Database>,
  orgId: string,
  roles: string[],
): Promise<string[]> {
  const { data } = await supabase.from("org_memberships").select("user_id").eq("org_id", orgId).in("role", roles);
  return (data ?? []).map((m) => m.user_id);
}
