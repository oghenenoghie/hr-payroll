import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { NewMemberForm } from "./NewMemberForm";

export default async function NewTeamMemberPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: unlinkedEmployees } = await supabase
    .from("employees")
    .select("id, full_name, email, employee_id")
    .eq("org_id", membership.orgId)
    .is("user_id", null)
    .order("full_name");

  const { data: roles } = await supabase.from("roles").select("key, label").order("sort_order");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Security &amp; Access</span>
        <h1 className="text-[22px] font-extrabold text-ink">Add a team member</h1>
        <p className="text-[13px] text-ink-soft">
          Creates their login immediately with a generated password — no invite email is sent. Copy the credentials
          on the next screen and send them to your teammate directly.
        </p>
      </header>

      <NewMemberForm unlinkedEmployees={unlinkedEmployees ?? []} roles={roles ?? []} />
    </div>
  );
}
