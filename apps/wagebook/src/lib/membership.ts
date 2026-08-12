import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

export type Membership = {
  role: string;
  orgId: string;
  orgName: string | null;
  mfaRequired: boolean;
};

export async function getMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Membership | null> {
  const { data } = await supabase
    .from("org_memberships")
    .select("role, org_id, organizations(name), roles(mfa_required)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    role: data.role,
    orgId: data.org_id,
    orgName: data.organizations?.name ?? null,
    // roles.mfa_required is the source of truth for who's gated into MFA
    // setup — a data change (see 20260729010000_roles_and_permissions.sql)
    // rather than a code change whenever that set needs to grow.
    mfaRequired: data.roles?.mfa_required ?? false,
  };
}
