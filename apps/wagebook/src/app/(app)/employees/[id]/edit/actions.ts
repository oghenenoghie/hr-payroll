"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";

export type EditEmployeeState = { error?: string } | null;

export async function editEmployee(
  employeeId: string,
  _prevState: EditEmployeeState,
  formData: FormData,
): Promise<EditEmployeeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    return { error: "Full name is required." };
  }

  const stateOfResidence = String(formData.get("state_of_residence") ?? "").trim() || null;
  const tin = String(formData.get("tin") ?? "").trim() || null;
  const pfa = String(formData.get("pfa") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");
  const basicNaira = Number(formData.get("basic") ?? 0);
  const housingNaira = Number(formData.get("housing") ?? 0);
  const transportNaira = Number(formData.get("transport") ?? 0);
  const annualRentNaira = Number(formData.get("annual_rent") ?? 0);

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      state_of_residence: stateOfResidence,
      basic_kobo: Number(naira(basicNaira)),
      housing_kobo: Number(naira(housingNaira)),
      transport_kobo: Number(naira(transportNaira)),
      annual_rent_kobo: Number(naira(annualRentNaira)),
      tin,
      pfa,
      status,
    })
    .eq("id", employeeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/employees");
  redirect("/employees");
}
