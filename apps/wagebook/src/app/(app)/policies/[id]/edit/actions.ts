"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EditPolicyState = { error?: string } | null;

export async function editPolicy(
  policyId: string,
  _prevState: EditPolicyState,
  formData: FormData,
): Promise<EditPolicyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title) {
    return { error: "Enter a policy title." };
  }
  if (!content) {
    return { error: "Enter the policy content." };
  }

  const { error } = await supabase
    .from("company_policies")
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq("id", policyId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/policies");
  redirect("/policies");
}
