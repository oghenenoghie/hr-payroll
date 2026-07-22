import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

export type Membership = {
  role: string;
  orgId: string;
  orgName: string | null;
};

export async function getMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Membership | null> {
  const { data } = await supabase
    .from("org_memberships")
    .select("role, org_id, organizations(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return { role: data.role, orgId: data.org_id, orgName: data.organizations?.name ?? null };
}
