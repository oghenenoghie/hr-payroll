"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { naira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getOrgRoleUserIds, notifyUsers } from "@/lib/notifications";

export type RequestLoanState = { error?: string; success?: boolean } | null;

export async function requestLoan(_prevState: RequestLoanState, formData: FormData): Promise<RequestLoanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, org_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet." };
  }

  const principalNaira = Number(formData.get("principal") ?? 0);
  const monthlyRepaymentNaira = Number(formData.get("monthly_repayment") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!(principalNaira > 0)) {
    return { error: "Enter a loan amount greater than zero." };
  }
  if (!(monthlyRepaymentNaira > 0)) {
    return { error: "Enter a monthly repayment amount greater than zero." };
  }
  if (monthlyRepaymentNaira > principalNaira) {
    return { error: "Monthly repayment can't exceed the loan amount." };
  }

  const principalKobo = naira(principalNaira);

  const { error } = await supabase.from("loans").insert({
    org_id: employee.org_id,
    employee_id: employee.id,
    principal_kobo: Number(principalKobo),
    monthly_repayment_kobo: Number(naira(monthlyRepaymentNaira)),
    outstanding_kobo: Number(principalKobo),
    requested_by: user.id,
    reason,
  });

  if (error) {
    return { error: error.message };
  }

  const approverIds = await getOrgRoleUserIds(supabase, employee.org_id, ["admin", "payroll_manager"]);
  await notifyUsers(supabase, {
    orgId: employee.org_id,
    recipientUserIds: approverIds,
    type: "loan_request_submitted",
    message: `${employee.full_name} requested a loan.`,
    link: "/loans",
  });

  revalidatePath("/me");
  return { success: true };
}

export type RequestExpenseState = { error?: string; success?: boolean } | null;

export async function requestExpense(_prevState: RequestExpenseState, formData: FormData): Promise<RequestExpenseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, org_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet." };
  }

  const amountNaira = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "").trim();

  if (!(amountNaira > 0)) {
    return { error: "Enter a claim amount greater than zero." };
  }
  if (!description) {
    return { error: "Describe what the claim is for." };
  }

  const { error } = await supabase.from("expenses").insert({
    org_id: employee.org_id,
    employee_id: employee.id,
    amount_kobo: Number(naira(amountNaira)),
    description,
    requested_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  const approverIds = await getOrgRoleUserIds(supabase, employee.org_id, ["admin", "payroll_manager"]);
  await notifyUsers(supabase, {
    orgId: employee.org_id,
    recipientUserIds: approverIds,
    type: "expense_submitted",
    message: `${employee.full_name} submitted an expense claim.`,
    link: "/expenses",
  });

  revalidatePath("/me");
  return { success: true };
}

export type RequestOvertimeState = { error?: string; success?: boolean } | null;

export async function requestOvertime(
  _prevState: RequestOvertimeState,
  formData: FormData,
): Promise<RequestOvertimeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, org_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet." };
  }

  const workDate = String(formData.get("work_date") ?? "");
  const hours = Number(formData.get("hours") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!workDate) {
    return { error: "Enter the date the overtime was worked." };
  }
  if (!(hours > 0) || hours > 24) {
    return { error: "Enter hours worked between 0 and 24." };
  }

  const { error } = await supabase.from("overtime_requests").insert({
    org_id: employee.org_id,
    employee_id: employee.id,
    work_date: workDate,
    hours,
    reason,
    requested_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  const approverIds = await getOrgRoleUserIds(supabase, employee.org_id, ["admin", "payroll_manager"]);
  await notifyUsers(supabase, {
    orgId: employee.org_id,
    recipientUserIds: approverIds,
    type: "overtime_request_submitted",
    message: `${employee.full_name} submitted an overtime request.`,
    link: "/overtime",
  });

  revalidatePath("/me");
  return { success: true };
}

export type RequestLeaveState = { error?: string; success?: boolean } | null;

export async function requestLeave(_prevState: RequestLeaveState, formData: FormData): Promise<RequestLeaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, org_id, full_name, manager_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet." };
  }

  const leaveType = String(formData.get("leave_type") ?? "annual");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (leaveType !== "annual" && leaveType !== "unpaid") {
    return { error: "Invalid leave type." };
  }
  if (!startDate || !endDate) {
    return { error: "Start and end dates are required." };
  }

  // Computed server-side, never trusted from the client — the days column
  // has a check constraint that must match end_date - start_date + 1.
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  if (!(days > 0)) {
    return { error: "End date must be on or after the start date." };
  }

  const { error: leaveError } = await supabase.from("leave_requests").insert({
    org_id: employee.org_id,
    employee_id: employee.id,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    days,
    reason,
    requested_by: user.id,
  });

  if (leaveError) {
    return { error: leaveError.message };
  }

  const approverIds = await getOrgRoleUserIds(supabase, employee.org_id, ["admin", "hr_manager"]);
  if (employee.manager_id) {
    const { data: manager } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", employee.manager_id)
      .maybeSingle();
    if (manager?.user_id) approverIds.push(manager.user_id);
  }
  await notifyUsers(supabase, {
    orgId: employee.org_id,
    recipientUserIds: approverIds,
    type: "leave_request_submitted",
    message: `${employee.full_name} requested ${leaveType} leave.`,
    link: "/leave",
  });

  revalidatePath("/me");
  return { success: true };
}
