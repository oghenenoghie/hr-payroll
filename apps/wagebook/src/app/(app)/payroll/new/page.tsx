import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { PayRunForm } from "./PayRunForm";

export default async function NewPayRunPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership) {
    redirect("/dashboard");
  }

  // Matches createPayRun's own authorization check (actions.ts) — only
  // admin/payroll_manager/accountant can actually run payroll, so anyone
  // else landing here (direct link, bookmark, back button) gets redirected
  // before the form — and the active employee list it needs — ever
  // renders, rather than seeing a live-looking form they can't submit.
  if (!["admin", "payroll_manager", "accountant"].includes(membership.role)) {
    redirect("/payroll");
  }

  // Only needed for the Bonus frequency's per-employee amount inputs — every
  // other frequency pays whoever is active automatically, computed server-side.
  const { data: activeEmployees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("org_id", membership.orgId)
    .eq("status", "active")
    .order("full_name");

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
        <h1 className="text-[22px] font-extrabold text-ink">Run payroll</h1>
        <p className="text-[13px] text-ink-soft">
          Computes each active employee&apos;s payslip from the compliance engine and posts a balanced ledger entry.
        </p>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <PayRunForm employees={activeEmployees ?? []} />
      </div>
    </div>
  );
}
