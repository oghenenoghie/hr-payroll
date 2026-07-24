import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EditPolicyForm } from "./EditPolicyForm";

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin" && membership?.role !== "hr_manager") {
    redirect("/policies");
  }

  const { data: policy } = await supabase.from("company_policies").select("*").eq("id", id).maybeSingle();
  if (!policy) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Company Policies</span>
        <h1 className="text-[22px] font-extrabold text-ink">{policy.title}</h1>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <EditPolicyForm policy={policy} />
      </div>
    </div>
  );
}
