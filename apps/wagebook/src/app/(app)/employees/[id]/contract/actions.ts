"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SignContractState = { error?: string } | null;

export async function signContractAsEmployer(
  employeeId: string,
  _prevState: SignContractState,
  formData: FormData,
): Promise<SignContractState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const documentHash = String(formData.get("document_hash") ?? "").trim();
  if (!documentHash) {
    return { error: "Missing document hash." };
  }

  const ipAddress = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabase.rpc("sign_employment_contract", {
    p_employee_id: employeeId,
    p_party: "employer",
    p_document_hash: documentHash,
    p_ip_address: ipAddress,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/employees/${employeeId}/contract`);
  return null;
}
