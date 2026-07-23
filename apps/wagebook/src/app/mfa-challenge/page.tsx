import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./MfaChallengeForm";

export default async function MfaChallengePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === aal.nextLevel) {
    redirect("/dashboard");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedFactor = (factorsData?.all ?? []).find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );

  if (!verifiedFactor) {
    // No verified factor to challenge against — nothing to step up to.
    redirect("/dashboard");
  }

  return (
    <AuthCard title="Verify it's you" subtitle="Enter the 6-digit code from your authenticator app.">
      <MfaChallengeForm factorId={verifiedFactor.id} />
    </AuthCard>
  );
}
