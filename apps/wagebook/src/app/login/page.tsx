import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="card max-w-sm w-full">
        <p className="label-micro mb-2">Plutus Technologies</p>
        <h1 className="text-xl font-extrabold mb-6">Sign in</h1>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
