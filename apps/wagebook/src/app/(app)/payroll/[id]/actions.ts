"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReversePayRunState = { error?: string } | null;

export async function reversePayRun(
  payRunId: string,
  _prevState: ReversePayRunState,
  formData: FormData,
): Promise<ReversePayRunState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { error: "A reason is required to reverse a pay run." };
  }

  const { error } = await supabase.rpc("reverse_pay_run", { p_pay_run_id: payRunId, p_reason: reason });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/payroll");
  return null;
}
