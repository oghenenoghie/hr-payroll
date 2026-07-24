"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";

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
  const probationEndDate = String(formData.get("probation_end_date") ?? "").trim() || null;
  const confirmed = formData.get("confirmed") === "true";
  const employmentType = String(formData.get("employment_type") ?? "permanent").trim() || "permanent";
  const contractEndDate = String(formData.get("contract_end_date") ?? "").trim() || null;
  const tin = String(formData.get("tin") ?? "").trim() || null;
  const pfa = String(formData.get("pfa") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const branchId = String(formData.get("branch_id") ?? "").trim() || null;
  const jobGradeId = String(formData.get("job_grade_id") ?? "").trim() || null;
  const managerId = String(formData.get("manager_id") ?? "").trim() || null;
  if (managerId === employeeId) {
    return { error: "An employee cannot be their own manager." };
  }
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const nationality = String(formData.get("nationality") ?? "").trim() || null;
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const bankAccountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const bankAccountName = String(formData.get("bank_account_name") ?? "").trim() || null;
  const basicNaira = Number(formData.get("basic") ?? 0);
  const housingNaira = Number(formData.get("housing") ?? 0);
  const transportNaira = Number(formData.get("transport") ?? 0);
  const annualRentNaira = Number(formData.get("annual_rent") ?? 0);
  const salaryMaskedRequested = formData.get("salary_masked") === "true";

  if (bankAccountNumber && !/^\d{10}$/.test(bankAccountNumber)) {
    return { error: "Bank account number (NUBAN) must be exactly 10 digits." };
  }

  // Salary masking gate: an hr_manager can never write salary/bank fields
  // for an employee currently masked from them (regardless of what a
  // crafted request sends — the client already hides these inputs, but
  // this is the actual enforcement), and never controls the mask flag
  // itself, since letting HR unmask their own view would defeat it.
  const membership = await getMembership(supabase, user.id);
  const isAdminOrPayroll = membership?.role === "admin" || membership?.role === "payroll_manager";
  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("salary_masked")
    .eq("id", employeeId)
    .maybeSingle();
  const canEditSalary = isAdminOrPayroll || !currentEmployee?.salary_masked;

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      state_of_residence: stateOfResidence,
      hire_date: hireDate,
      probation_end_date: probationEndDate,
      confirmed,
      tin,
      pfa,
      status,
      department_id: departmentId,
      branch_id: branchId,
      job_grade_id: jobGradeId,
      manager_id: managerId,
      date_of_birth: dateOfBirth,
      nationality,
      employment_type: employmentType,
      contract_end_date: contractEndDate,
      ...(canEditSalary
        ? {
            basic_kobo: Number(naira(basicNaira)),
            housing_kobo: Number(naira(housingNaira)),
            transport_kobo: Number(naira(transportNaira)),
            annual_rent_kobo: Number(naira(annualRentNaira)),
            bank_name: bankName,
            bank_account_number: bankAccountNumber,
            bank_account_name: bankAccountName,
          }
        : {}),
      ...(isAdminOrPayroll ? { salary_masked: salaryMaskedRequested } : {}),
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

export type SaveOffboardingChecklistState = { error?: string } | null;

export async function saveOffboardingChecklist(
  employeeId: string,
  _prevState: SaveOffboardingChecklistState,
  formData: FormData,
): Promise<SaveOffboardingChecklistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    return { error: "You don't have permission to update the offboarding checklist." };
  }

  const { error } = await supabase.from("employee_offboarding_checklist").upsert(
    {
      org_id: membership.orgId,
      employee_id: employeeId,
      notice_period_served: formData.get("notice_period_served") === "true",
      assets_returned: formData.get("assets_returned") === "true",
      clearance_obtained: formData.get("clearance_obtained") === "true",
      experience_letter_issued: formData.get("experience_letter_issued") === "true",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "employee_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/employees/${employeeId}/edit`);
  return null;
}
