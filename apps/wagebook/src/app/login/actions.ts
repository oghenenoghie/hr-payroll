"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignInState = { error?: string } | null;

const INVALID_CREDENTIALS_ERROR = "Invalid login credentials";

// The identifier field takes either. An employee ID never contains '@', so
// that's the only shape check needed — anything else goes straight to
// Supabase as an email, unchanged from before this existed.
async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) {
    return identifier;
  }

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("user_id")
    .eq("employee_id", identifier)
    .maybeSingle();

  if (!employee?.user_id) {
    return null;
  }

  const { data } = await admin.auth.admin.getUserById(employee.user_id);
  return data.user?.email ?? null;
}

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // An unresolved employee ID fails with the same message a wrong password
  // would, rather than "no such ID" — that distinction would let anyone
  // probe which employee IDs exist without a password at all.
  const email = await resolveLoginEmail(identifier);
  if (!email) {
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect("/mfa-challenge");
  }

  redirect("/dashboard");
}

export async function signInWithGoogle(_prevState: SignInState): Promise<SignInState> {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(data.url);
}
