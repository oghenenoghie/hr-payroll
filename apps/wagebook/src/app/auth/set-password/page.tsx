import { AuthCard } from "@/components/AuthCard";
import { SetPasswordForm } from "./SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <AuthCard title="Set your password" subtitle="Choose a password for your account.">
      <SetPasswordForm />
    </AuthCard>
  );
}
