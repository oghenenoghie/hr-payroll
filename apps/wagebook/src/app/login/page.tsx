import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <AuthCard title="Sign in" subtitle="Sign in to your compliance-native payroll workspace.">
      <LoginForm message={message} />
    </AuthCard>
  );
}
