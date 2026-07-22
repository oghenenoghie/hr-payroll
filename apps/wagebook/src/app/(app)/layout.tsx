import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { signOut } from "./dashboard/actions";
import { SidebarNav } from "./SidebarNav";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  payroll_manager: "Payroll Manager",
  hr_manager: "HR Manager",
  employee: "Employee",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[240px] shrink-0 flex-col justify-between bg-primary-dark px-4 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-0.5 px-2">
            <span className="text-[15px] font-extrabold text-white">Plutus</span>
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.03em] text-primary-tint">
              Technologies
            </span>
          </div>
          <SidebarNav role={membership?.role} />
        </div>

        <div className="flex flex-col gap-3 border-t border-primary px-2 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[12.5px] font-bold text-white">
              {membership?.orgName ?? "Your organization"}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-primary-tint">
              {membership ? (ROLE_LABEL[membership.role] ?? membership.role) : ""}
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-control border border-primary-tint px-3 py-2 text-[12.5px] font-bold text-primary-tint"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
    </div>
  );
}
