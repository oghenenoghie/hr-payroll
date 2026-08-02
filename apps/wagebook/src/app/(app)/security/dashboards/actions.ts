"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard-widgets";

export type SetWidgetVisibilityState = { error?: string } | null;

export async function setWidgetVisibility(
  widgetKey: string,
  _prevState: SetWidgetVisibilityState,
  formData: FormData,
): Promise<SetWidgetVisibilityState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role !== "admin") {
    return { error: "You don't have permission to change dashboard visibility." };
  }

  const widget = DASHBOARD_WIDGETS.find((w) => w.key === widgetKey);
  if (!widget) {
    return { error: "Unknown widget." };
  }

  const { data: roles } = await supabase.from("roles").select("key");
  const allRoleKeys = (roles ?? []).map((r) => r.key);
  const selectedRoleKeys = allRoleKeys.filter((key) => formData.get(key) === "on");

  if (selectedRoleKeys.length === 0) {
    return {
      error: "Select at least one role — restricting a widget to nobody isn't supported here.",
    };
  }

  const { error: deleteError } = await supabase
    .from("dashboard_widget_visibility")
    .delete()
    .eq("org_id", membership.orgId)
    .eq("widget_key", widgetKey);
  if (deleteError) {
    return { error: deleteError.message };
  }

  // Selecting exactly the widget's own default roles means "revert to
  // default" — the same thing an untouched widget already means with
  // zero rows — so it's left as zero rows rather than one redundant row
  // per role. This also means the widget automatically keeps tracking
  // its coded default if that default ever changes later.
  const isExactlyDefault =
    selectedRoleKeys.length === widget.defaultRoles.length &&
    widget.defaultRoles.every((key) => selectedRoleKeys.includes(key));

  if (!isExactlyDefault) {
    const { error: insertError } = await supabase.from("dashboard_widget_visibility").insert(
      selectedRoleKeys.map((role_key) => ({
        org_id: membership.orgId,
        widget_key: widgetKey,
        role_key,
        created_by: user.id,
      })),
    );
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/security/dashboards");
  revalidatePath("/dashboard");
  return null;
}
