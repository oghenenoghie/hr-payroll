import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { MfaSetupForm } from "./MfaSetupForm";

export default async function MfaSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const totpFactors = (factorsData?.all ?? []).filter((factor) => factor.factor_type === "totp");
  const existingVerified = totpFactors.find((factor) => factor.status === "verified");

  if (existingVerified) {
    redirect("/dashboard");
  }

  // Clear any abandoned enrollment attempt (e.g. a page refresh mid-setup)
  // before starting fresh — the QR code and secret are only ever returned
  // once, at enroll time, so a stale unverified factor can't be resumed.
  for (const stale of totpFactors.filter((factor) => factor.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Plutus Technologies",
  });

  if (error || !enrolled) {
    return (
      <AuthCard title="Set up two-factor authentication" subtitle="Required for Admin and Payroll Manager roles.">
        <p className="text-[13px] text-bad">
          {error?.message ?? "Could not start MFA enrollment. Refresh the page to try again."}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up two-factor authentication"
      subtitle="Required for Admin and Payroll Manager roles — scan the QR code with an authenticator app."
    >
      <MfaSetupForm
        factorId={enrolled.id}
        qrCodeDataUri={enrolled.totp.qr_code}
        secret={enrolled.totp.secret}
      />
    </AuthCard>
  );
}
