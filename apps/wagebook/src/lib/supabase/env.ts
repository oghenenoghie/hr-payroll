/**
 * Single source of truth for the Supabase client env vars. The project
 * standardises on `NEXT_PUBLIC_SUPABASE_ANON_KEY` (README §6) rather than
 * aliasing it with Supabase's newer `..._PUBLISHABLE_KEY` naming — a prior
 * bug here came from exactly that drift. The value itself may be either a
 * legacy anon key or a modern `sb_publishable_...` key; only the env var
 * name is fixed.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
}
