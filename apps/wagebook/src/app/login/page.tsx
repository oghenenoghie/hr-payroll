import Link from "next/link";
import { AuthCard, FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthCard title="Sign in" subtitle="Sign in to your compliance-native payroll workspace.">
      <form action={signIn} className="flex flex-col gap-4">
        <FormNotice message={message} />
        <FormError message={error} />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-soft">
        New to Plutus?{" "}
        <Link href="/signup" className="font-bold text-primary">
          Set up your company
        </Link>
      </p>
    </AuthCard>
  );
}
