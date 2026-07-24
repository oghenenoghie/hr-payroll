import { redirect } from "next/navigation";
import { AuthCard, SubmitButton } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(app)/dashboard/actions";

export default async function AccountRevokedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Re-check rather than trust the redirect that sent the user here — an
  // employee reinstated (status flipped back to active) after landing on
  // this page should not get stuck behind a stale gate.
  const { data: employee } = await supabase.from("employees").select("status").eq("user_id", user.id).maybeSingle();
  if (employee?.status !== "terminated") {
    redirect("/dashboard");
  }

  return (
    <AuthCard
      title="Access revoked"
      subtitle="Your employment record is marked as exited, so self-service access to this account has been switched off. Contact your HR administrator if you believe this is a mistake."
    >
      <form action={signOut}>
        <SubmitButton>Sign out</SubmitButton>
      </form>
    </AuthCard>
  );
}
