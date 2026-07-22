import Link from "next/link";
import { AuthCard, FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { signUp } from "./actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard title="Create your account" subtitle="Set up Plutus for your company in a couple of minutes.">
      <form action={signUp} className="flex flex-col gap-4">
        <FormError message={error} />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <SubmitButton>Continue</SubmitButton>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-primary">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
