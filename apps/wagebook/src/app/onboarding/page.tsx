import { redirect } from "next/navigation";
import { AuthCard, FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthCard title="Set up your company" subtitle="This creates your organization and makes you its admin.">
      <form action={createOrganization} className="flex flex-col gap-4">
        <FormError message={error} />
        <FormField label="Company name" name="name" />
        <SubmitButton>Create organization</SubmitButton>
      </form>
    </AuthCard>
  );
}
