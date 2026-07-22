import Link from "next/link";
import { PayeCalculator } from "@/components/PayeCalculator";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end gap-3 border-b border-border bg-surface px-6 py-3">
        {user ? (
          <Link href="/dashboard" className="text-[13px] font-bold text-primary">
            Dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-[13px] font-bold text-ink-soft">
              Sign in
            </Link>
            <Link href="/signup" className="text-[13px] font-bold text-primary">
              Get started
            </Link>
          </>
        )}
      </div>
      <PayeCalculator />
    </div>
  );
}
