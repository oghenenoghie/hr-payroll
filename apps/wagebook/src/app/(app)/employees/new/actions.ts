"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";

export type AddEmployeeState = { error?: string } | null;

export async function addEmployee(_prevState: AddEmployeeState, formData: FormData): Promise<AddEmployeeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .in("role", ["admin", "hr_manager"]);

  const membership = memberships?.[0];
  if (!membership) {
    return { error: "You don't have permission to add employees." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    return { error: "Full name is required." };
  }

  const email = String(formData.get("email") ?? "").trim() || null;
  const stateOfResidence = String(formData.get("state_of_residence") ?? "").trim() || null;
  const hireDate = String(formData.get("hire_date") ?? "").trim() || null;
  const tin = String(formData.get("tin") ?? "").trim() || null;
  const pfa = String(formData.get("pfa") ?? "").trim() || null;
  const basicNaira = Number(formData.get("basic") ?? 0);
  const housingNaira = Number(formData.get("housing") ?? 0);
  const transportNaira = Number(formData.get("transport") ?? 0);
  const annualRentNaira = Number(formData.get("annual_rent") ?? 0);

  const { error } = await supabase.from("employees").insert({
    org_id: membership.org_id,
    full_name: fullName,
    email,
    state_of_residence: stateOfResidence,
    hire_date: hireDate,
    basic_kobo: Number(naira(basicNaira)),
    housing_kobo: Number(naira(housingNaira)),
    transport_kobo: Number(naira(transportNaira)),
    annual_rent_kobo: Number(naira(annualRentNaira)),
    tin,
    pfa,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/employees");
  redirect("/employees");
}
