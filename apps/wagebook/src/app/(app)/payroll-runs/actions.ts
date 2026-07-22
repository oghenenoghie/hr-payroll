"use server";

import { NG_2026_1, assertTinGate, computePayslip, TinGateError, type PayComponents } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";

export interface CreatePayRunInput {
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  frequency: "weekly" | "biweekly" | "monthly";
}

export interface CreatePayRunResult {
  ok: boolean;
  error?: string;
  blockedEmployees?: string[];
  payRunId?: string;
}

export async function createPayRun(input: CreatePayRunInput): Promise<CreatePayRunResult> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) {
    return { ok: false, error: "Not authenticated." };
  }
  const userId = (claims as { sub?: string }).sub;

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").limit(1).maybeSingle();
  if (!membership) {
    return { ok: false, error: "No organization found for this account." };
  }
  if (membership.role !== "admin" && membership.role !== "payroll_manager") {
    return { ok: false, error: "Only Admins and Payroll Managers can run payroll." };
  }
  const orgId = membership.org_id;

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, full_name, basic_kobo, housing_kobo, transport_kobo, annual_rent_kobo, tin, tin_valid_from, tin_valid_to")
    .eq("status", "active");
  if (employeesError) {
    return { ok: false, error: employeesError.message };
  }
  if (!employees || employees.length === 0) {
    return { ok: false, error: "No active employees to run payroll for." };
  }

  // TIN gating: block the whole run before anything is written, never
  // process a TIN-less employee silently.
  try {
    assertTinGate(
      employees.map((e) => ({
        id: e.id,
        tin: { tin: e.tin, validFrom: e.tin_valid_from ?? undefined, validTo: e.tin_valid_to ?? undefined },
      })),
      input.periodEnd,
    );
  } catch (error) {
    if (error instanceof TinGateError) {
      const blockedIds = new Set(error.blockedEmployeeIds);
      return {
        ok: false,
        error: "Run blocked: one or more employees are missing a valid TIN.",
        blockedEmployees: employees.filter((e) => blockedIds.has(e.id)).map((e) => e.full_name),
      };
    }
    throw error;
  }

  const periodYearStart = `${new Date(input.periodStart).getUTCFullYear()}-01-01`;
  const periodYearEnd = `${new Date(input.periodStart).getUTCFullYear() + 1}-01-01`;

  const payslipRows: Array<{
    employee_id: string;
    org_id: string;
    gross_kobo: number;
    pensionable_kobo: number;
    pension_employee_kobo: number;
    pension_employer_kobo: number;
    nhf_kobo: number;
    rent_relief_kobo: number;
    chargeable_income_kobo: number;
    paye_kobo: number;
    employee_deductions_kobo: number;
    net_kobo: number;
    cumulative_chargeable_income_before_kobo: number;
    cumulative_paye_paid_before_kobo: number;
  }> = [];

  let totalGross = 0n;
  let totalNet = 0n;

  for (const employee of employees) {
    // Cumulative year-to-date position from this employee's prior payslips
    // this calendar year — cumulative PAYE must be re-derived from real
    // history, never assumed to be a flat monthly slice.
    const { data: priorPayslips, error: priorError } = await supabase
      .from("payslips")
      .select("chargeable_income_kobo, paye_kobo, pay_runs!inner(period_start)")
      .eq("employee_id", employee.id)
      .gte("pay_runs.period_start", periodYearStart)
      .lt("pay_runs.period_start", periodYearEnd);
    if (priorError) {
      return { ok: false, error: priorError.message };
    }

    const cumulativeChargeableIncomeBeforePeriod = (priorPayslips ?? []).reduce(
      (sum, p) => sum + BigInt(p.chargeable_income_kobo),
      0n,
    );
    const cumulativePayeAlreadyPaid = (priorPayslips ?? []).reduce((sum, p) => sum + BigInt(p.paye_kobo), 0n);

    const components: PayComponents = {
      basic: BigInt(employee.basic_kobo),
      housing: BigInt(employee.housing_kobo),
      transport: BigInt(employee.transport_kobo),
    };

    const derivation = computePayslip(
      {
        components,
        annualRent: BigInt(employee.annual_rent_kobo),
        cumulativeChargeableIncomeBeforePeriod,
        cumulativePayeAlreadyPaid,
      },
      NG_2026_1,
    );

    totalGross += derivation.gross;
    totalNet += derivation.net;

    payslipRows.push({
      employee_id: employee.id,
      org_id: orgId,
      gross_kobo: Number(derivation.gross),
      pensionable_kobo: Number(derivation.pensionable),
      pension_employee_kobo: Number(derivation.pensionEmployee),
      pension_employer_kobo: Number(derivation.pensionEmployer),
      nhf_kobo: Number(derivation.nhf),
      rent_relief_kobo: Number(derivation.rentRelief),
      chargeable_income_kobo: Number(derivation.chargeableIncomeThisPeriod),
      paye_kobo: Number(derivation.paye),
      employee_deductions_kobo: Number(derivation.employeeDeductions),
      net_kobo: Number(derivation.net),
      cumulative_chargeable_income_before_kobo: Number(cumulativeChargeableIncomeBeforePeriod),
      cumulative_paye_paid_before_kobo: Number(cumulativePayeAlreadyPaid),
    });
  }

  const { data: payRun, error: payRunError } = await supabase
    .from("pay_runs")
    .insert({
      org_id: orgId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      frequency: input.frequency,
      rule_version_id: NG_2026_1.id,
      employee_count: employees.length,
      gross_kobo: Number(totalGross),
      net_kobo: Number(totalNet),
      created_by: userId,
    })
    .select("id")
    .single();

  if (payRunError || !payRun) {
    return { ok: false, error: payRunError?.message ?? "Failed to create pay run." };
  }

  const { error: payslipsError } = await supabase
    .from("payslips")
    .insert(payslipRows.map((row) => ({ ...row, pay_run_id: payRun.id })));

  if (payslipsError) {
    return { ok: false, error: payslipsError.message };
  }

  return { ok: true, payRunId: payRun.id };
}
