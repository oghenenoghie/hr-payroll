"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const hireDate = String(formData.get("hire_date") ?? "").trim() || null;
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
      hire_date: hireDate,
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

export type InviteState = { error?: string; success?: boolean } | null;

// Sends the self-service invite and links the resulting account in one
// step, using the admin's own authenticated session — never anything the
// invitee later controls. inviteUserByEmail() returns the new auth user's
// id synchronously, so link_employee_account() runs right here, before the
// invitee has done anything at all.
export async function inviteEmployeeAccount(
  employeeId: string,
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee, error: fetchError } = await supabase
    .from("employees")
    .select("id, email, user_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (fetchError || !employee) {
    return { error: "Employee not found." };
  }

  if (employee.user_id) {
    return { error: "This employee already has a linked account." };
  }

  let email = employee.email;
  if (!email) {
    const submitted = String(formData.get("email") ?? "").trim();
    if (!submitted) {
      return { error: "Enter an email address to invite this employee." };
    }
    const { error: emailError } = await supabase.from("employees").update({ email: submitted }).eq("id", employeeId);
    if (emailError) {
      return { error: emailError.message };
    }
    email = submitted;
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Failed to send invite." };
  }

  const { error: linkError } = await supabase.rpc("link_employee_account", {
    p_employee_id: employeeId,
    p_user_id: invited.user.id,
  });

  if (linkError) {
    return { error: `Invite sent, but linking the account failed: ${linkError.message}` };
  }

  revalidatePath(`/employees/${employeeId}/edit`);
  return { success: true };
}
