import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

// Service-role client: bypasses RLS entirely and can call auth.admin.*.
// The `server-only` import makes any accidental Client Component import of
// this module fail the build instead of shipping the key to the browser.
// Never add a NEXT_PUBLIC_ prefix to SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
