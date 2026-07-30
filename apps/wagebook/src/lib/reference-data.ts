import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@plutus/core";

// Short-lived caching for genuinely static, org-scoped lookup data —
// departments/branches/job grades/chart of accounts change rarely
// (an admin editing them explicitly) and every role that can reach a page
// referencing them sees the identical rows, so a single per-org cache
// entry is safe to share across every request for that org.
//
// Deliberately NOT used for anything payroll/balance/salary-related, or
// anything that differs by viewer role (e.g. salary-masked employee data)
// — this is reference data only, per the same rule the rest of this
// performance pass follows: never cache financially sensitive or
// per-viewer-masked data.
//
// unstable_cache's callback can't call cookies()/headers() (Next.js
// forbids dynamic APIs inside a cached function), so this uses the
// existing service-role admin client instead of the per-request RLS
// client — RLS is bypassed here, so every query below filters by org_id
// explicitly itself rather than relying on a policy to do it. The caller
// must already have verified the requesting user belongs to that org
// before ever calling one of these (every call site below sits behind the
// page's own existing getMembership() check, same as before).
const REVALIDATE_SECONDS = 60;

export const getCachedDepartments = unstable_cache(
  async (orgId: string): Promise<Pick<Tables<"departments">, "id" | "name">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("departments").select("id, name").eq("org_id", orgId).order("name");
    return data ?? [];
  },
  ["departments-by-org"],
  { revalidate: REVALIDATE_SECONDS, tags: ["departments"] },
);

export const getCachedBranches = unstable_cache(
  async (orgId: string): Promise<Pick<Tables<"branches">, "id" | "name">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("branches").select("id, name").eq("org_id", orgId).order("name");
    return data ?? [];
  },
  ["branches-by-org"],
  { revalidate: REVALIDATE_SECONDS, tags: ["branches"] },
);

export const getCachedJobGrades = unstable_cache(
  async (orgId: string): Promise<Tables<"job_grades">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("job_grades").select("*").eq("org_id", orgId).order("min_annual_kobo");
    return data ?? [];
  },
  ["job-grades-by-org"],
  { revalidate: REVALIDATE_SECONDS, tags: ["job_grades"] },
);

export const getCachedChartOfAccounts = unstable_cache(
  async (orgId: string): Promise<Pick<Tables<"chart_of_accounts">, "code" | "name" | "type">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("code, name, type")
      .eq("org_id", orgId)
      .order("code");
    return data ?? [];
  },
  ["chart-of-accounts-by-org"],
  { revalidate: REVALIDATE_SECONDS, tags: ["chart_of_accounts"] },
);
