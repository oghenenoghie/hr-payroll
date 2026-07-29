"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { ALL_SECTIONS, defaultSectionsForRole } from "@/lib/nav-sections";

export type UpdateNavAccessState = { error?: string } | null;

export async function updateNavAccess(
  targetUserId: string,
  _prevState: UpdateNavAccessState,
  formData: FormData,
): Promise<UpdateNavAccessState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "You don't have permission to change access." };
  }

  const { data: target } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", membership.orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) {
    return { error: "Member not found." };
  }

  const defaults = new Set(defaultSectionsForRole(target.role));

  // Only ever write an override row when it actually differs from the
  // role's default — a checkbox left matching the default clears any
  // stale override instead of storing a redundant one, so this table
  // stays exceptions-only (see the migration comment).
  for (const section of ALL_SECTIONS) {
    const checked = formData.get(section) === "on";
    const matchesDefault = defaults.has(section) === checked;

    const { error } = matchesDefault
      ? await supabase
          .from("user_nav_overrides")
          .delete()
          .eq("org_id", membership.orgId)
          .eq("user_id", targetUserId)
          .eq("section_key", section)
      : await supabase
          .from("user_nav_overrides")
          .upsert(
            { org_id: membership.orgId, user_id: targetUserId, section_key: section, enabled: checked },
            { onConflict: "org_id,user_id,section_key" },
          );

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath(`/security/${targetUserId}`);
  return null;
}
