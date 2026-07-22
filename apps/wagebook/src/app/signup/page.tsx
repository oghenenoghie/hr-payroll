import { AuthCard } from "@/components/AuthCard";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return (
    <AuthCard title="Create your account" subtitle="Set up Plutus for your company in a couple of minutes.">
      <SignUpForm />
    </AuthCard>
  );
}
