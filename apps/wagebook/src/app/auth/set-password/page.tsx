import { AuthCard } from "@/components/AuthCard";
import { SetPasswordForm } from "./SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <AuthCard title="Set your password" subtitle="Choose a password to finish setting up your account.">
      <SetPasswordForm />
    </AuthCard>
  );
}
