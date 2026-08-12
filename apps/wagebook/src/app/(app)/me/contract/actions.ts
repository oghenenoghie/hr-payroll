"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SignContractState = { error?: string } | null;

export async function signMyContract(_prevState: SignContractState, formData: FormData): Promise<SignContractState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();
  if (!employee) {
    return { error: "No employee record is linked to this account." };
  }

  const documentHash = String(formData.get("document_hash") ?? "").trim();
  if (!documentHash) {
    return { error: "Missing document hash." };
  }

  const ipAddress = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabase.rpc("sign_employment_contract", {
    p_employee_id: employee.id,
    p_party: "employee",
    p_document_hash: documentHash,
    p_ip_address: ipAddress,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/me/contract");
  return null;
}
