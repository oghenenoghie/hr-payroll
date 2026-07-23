"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

const PROVIDERS = new Set(["gtbank", "access_bank", "zenith_bank"]);

export async function toggleBankConnection(provider: string, currentlyConnected: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin" || !PROVIDERS.has(provider)) {
    return;
  }

  await supabase.from("integration_connections").upsert(
    {
      org_id: membership.orgId,
      provider,
      connected: !currentlyConnected,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,provider" },
  );

  revalidatePath("/integrations");
}
