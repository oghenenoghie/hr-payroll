"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type SetModuleVisibilityState = { error?: string } | null;

export async function setModuleVisibility(
  moduleKey: string,
  _prevState: SetModuleVisibilityState,
  formData: FormData,
): Promise<SetModuleVisibilityState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "You don't have permission to change module visibility." };
  }

  const { data: roles } = await supabase.from("roles").select("key");
  const allRoleKeys = (roles ?? []).map((r) => r.key);
  const selectedRoleKeys = allRoleKeys.filter((key) => formData.get(key) === "on");

  if (selectedRoleKeys.length === 0) {
    return {
      error: "Select at least one role — to make this module visible to everyone, check every role instead.",
    };
  }

  const { error: deleteError } = await supabase
    .from("module_role_visibility")
    .delete()
    .eq("org_id", membership.orgId)
    .eq("module_key", moduleKey);
  if (deleteError) {
    return { error: deleteError.message };
  }

  // Selecting every role means "visible to everyone" — the same thing an
  // untouched module already means with zero rows — so it's left as zero
  // rows rather than one redundant row per role. This also means a role
  // added later automatically sees an unrestricted module, matching the
  // "default open" behavior every module starts with.
  const isEveryRoleSelected = allRoleKeys.every((key) => selectedRoleKeys.includes(key));
  if (!isEveryRoleSelected) {
    const { error: insertError } = await supabase.from("module_role_visibility").insert(
      selectedRoleKeys.map((role_key) => ({
        org_id: membership.orgId,
        module_key: moduleKey,
        role_key,
        created_by: user.id,
      })),
    );
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/security/modules");
  revalidatePath("/featuremap");
  return null;
}
