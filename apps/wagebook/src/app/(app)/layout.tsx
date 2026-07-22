import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_LINKS = [
  { href: "/overview", label: "Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/payroll-runs", label: "Payroll Runs" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <p className="label-micro">Plutus Technologies</p>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <SignOutButton />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
