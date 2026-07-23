"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type VerifyChallengeState = { error?: string } | null;

export async function verifyMfaChallenge(
  factorId: string,
  _prevState: VerifyChallengeState,
  formData: FormData,
): Promise<VerifyChallengeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
