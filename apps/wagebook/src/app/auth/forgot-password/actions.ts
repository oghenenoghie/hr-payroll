"use server";

import { createClient } from "@/lib/supabase/server";

export type RequestPasswordResetState = { error?: string; sent?: boolean } | null;

const GENERIC_SENT_STATE: RequestPasswordResetState = { sent: true };

// Always reports success for a validly-formed email, whether or not an
// account exists for it — mirrors login's identifier-resolution comment:
// telling an unauthenticated caller "no such email" lets them enumerate
// who has an account. Supabase's own resetPasswordForEmail already
// behaves this way (silently no-ops for an unknown email); this just
// makes sure a real send failure isn't accidentally exposed the same way.
export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();

  // Format is checked here, before ever calling Supabase, so this is the
  // only case that can return an error at all — whether the address
  // actually has an account behind it is never distinguishable from the
  // response (see the comment above).
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);

  return GENERIC_SENT_STATE;
}
