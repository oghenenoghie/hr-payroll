import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth providers (Google) redirect back here with a `code` param after the
// user approves consent. This exchanges it for a session, mirroring the
// token_hash exchange in ../confirm/route.ts for email OTP links.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect(`/login?error=${encodeURIComponent("This link is invalid or has expired.")}`);
}
