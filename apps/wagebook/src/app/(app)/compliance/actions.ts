"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NG_2026_1, computeItf } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

export type RunItfAssessmentState = { error?: string } | null;

// Every figure computeItf() needs comes from this org's own real data —
// active headcount and gross payroll actually posted this calendar year
// — except annual turnover, which nothing in this build tracks anywhere
// else, so it's captured directly on the assessment itself rather than
// invented or left as a stale org-profile field that drifts year to
// year. The 1% rate and the qualifying threshold are never recomputed
// here — they come from computeItf() in @plutus/compliance, the single
// versioned source for both, same as every other statutory figure.
export async function runItfAssessment(
  _prevState: RunItfAssessmentState,
  formData: FormData,
): Promise<RunItfAssessmentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "finance_manager")
  ) {
    return { error: "You don't have permission to run an ITF assessment." };
  }

  const assessmentYear = Number(formData.get("assessment_year") ?? 0);
  const turnoverNaira = String(formData.get("annual_turnover_naira") ?? "").trim();

  if (!Number.isInteger(assessmentYear) || assessmentYear < 2000) {
    return { error: "Enter a valid assessment year." };
  }
  if (!turnoverNaira) {
    return { error: "Enter this year's annual turnover." };
  }
  const turnoverNairaNumber = Number(turnoverNaira);
  if (!Number.isFinite(turnoverNairaNumber) || turnoverNairaNumber < 0) {
    return { error: "Annual turnover must be a non-negative number." };
  }
  const annualTurnoverKobo = BigInt(Math.round(turnoverNairaNumber * 100));

  const { count: employeeCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.orgId)
    .eq("status", "active");

  const { data: payRuns } = await supabase
    .from("pay_runs")
    .select("gross_kobo")
    .eq("org_id", membership.orgId)
    .eq("status", "posted")
    .gte("period_start", `${assessmentYear}-01-01`)
    .lte("period_end", `${assessmentYear}-12-31`);

  const annualPayrollBaseKobo = (payRuns ?? []).reduce((sum, run) => sum + BigInt(run.gross_kobo), 0n);

  const ruleVersion = NG_2026_1;
  const result = computeItf(annualPayrollBaseKobo, { employeeCount: employeeCount ?? 0, annualTurnoverKobo }, ruleVersion);

  const { error } = await supabase.rpc("record_itf_assessment", {
    p_org_id: membership.orgId,
    p_assessment_year: assessmentYear,
    p_annual_payroll_base_kobo: Number(result.annualPayrollBaseKobo),
    p_employee_count: employeeCount ?? 0,
    p_annual_turnover_kobo: Number(annualTurnoverKobo),
    p_qualifies: result.qualifies,
    p_employer_kobo: Number(result.employerKobo),
    p_rule_version_id: ruleVersion.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/compliance");
  return null;
}
