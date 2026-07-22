import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's default email templates point at a Supabase-hosted verify
// endpoint. To land here instead, the project's email templates must use
// {{ .TokenHash }} and {{ .SiteURL }}/auth/confirm?token_hash=...&type=...
// — see Project Settings > Auth > Email Templates in the Supabase dashboard.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/me";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(type === "invite" ? "/auth/set-password" : next);
    }
  }

  redirect(`/login?error=${encodeURIComponent("This link is invalid or has expired.")}`);
}
