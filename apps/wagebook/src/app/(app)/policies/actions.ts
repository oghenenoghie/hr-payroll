"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";
import { getMembership } from "@/lib/membership";

export type CreatePolicyState = { error?: string; success?: boolean } | null;

export async function createPolicy(_prevState: CreatePolicyState, formData: FormData): Promise<CreatePolicyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin" && membership?.role !== "hr_manager") {
    return { error: "You don't have permission to publish a company policy." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title) {
    return { error: "Enter a policy title." };
  }
  if (!content) {
    return { error: "Enter the policy content." };
  }

  const { error } = await supabase.from("company_policies").insert({
    org_id: membership.orgId,
    title,
    content,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  // Broadcast to every linked employee account in the org — unlike every
  // other notification in this app, which targets a specific approver role
  // or the requester, a new policy is relevant to everyone who might need
  // to acknowledge it.
  const { data: linkedEmployees } = await supabase
    .from("employees")
    .select("user_id")
    .eq("org_id", membership.orgId)
    .not("user_id", "is", null);

  await notifyUsers(supabase, {
    orgId: membership.orgId,
    recipientUserIds: (linkedEmployees ?? []).map((e) => e.user_id!).filter(Boolean),
    type: "policy_published",
    message: `A new company policy was published: ${title}.`,
    link: "/me",
  });

  revalidatePath("/policies");
  return { success: true };
}
