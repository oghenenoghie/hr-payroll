import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmploymentContract } from "@/components/EmploymentContract";
import { PrintButton } from "@/components/PrintButton";
import { SignContractForm } from "@/components/SignContractForm";
import { computeContractHash } from "@/lib/contract-hash";
import { signContractAsEmployer } from "./actions";

export default async function EmployeeContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || membership.role === "employee") {
    redirect("/me");
  }

  // Reads through the salary-masked view, same as the certificate page: an
  // hr_manager viewer of a salary_masked employee gets null salary columns
  // back, which EmploymentContract renders as a restricted note.
  const [{ data: employee }, { data: signatures }] = await Promise.all([
    supabase
      .from("employees_masked")
      .select(
        "full_name, hire_date, employment_type, contract_end_date, job_grade_name, department_name, probation_end_date, confirmed, annual_leave_balance_days, basic_kobo, housing_kobo, transport_kobo",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("employment_contract_signatures")
      .select("party, document_hash, signed_at")
      .eq("employee_id", id)
      .order("signed_at", { ascending: false }),
  ]);
  if (!employee) notFound();

  const currentHash = await computeContractHash({
    employmentType: employee.employment_type ?? "permanent",
    hireDate: employee.hire_date,
    contractEndDate: employee.contract_end_date,
    jobGradeName: employee.job_grade_name,
    departmentName: employee.department_name,
    probationEndDate: employee.probation_end_date,
    confirmed: employee.confirmed ?? false,
    annualLeaveBalanceDays: Number(employee.annual_leave_balance_days ?? 0),
    basicKobo: employee.basic_kobo,
    housingKobo: employee.housing_kobo,
    transportKobo: employee.transport_kobo,
  });

  // The most recent signature for a party whose hash still matches the
  // contract as rendered right now — an older signature made against a
  // since-edited version of the contract (a comp change, a job grade
  // change, etc.) is kept in the audit trail but no longer shown as
  // covering today's document.
  const currentEmployerSignature = (signatures ?? []).find((s) => s.party === "employer" && s.document_hash === currentHash);
  const currentEmployeeSignature = (signatures ?? []).find((s) => s.party === "employee" && s.document_hash === currentHash);

  const canSignAsEmployer = membership.role === "admin" || membership.role === "hr_manager";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/employees/${id}/edit`} className="text-[13px] font-bold text-primary">
          ← Back to employee
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <EmploymentContract
        orgName={membership.orgName ?? "Your organization"}
        fullName={employee.full_name ?? ""}
        hireDate={employee.hire_date}
        employmentType={employee.employment_type ?? "permanent"}
        contractEndDate={employee.contract_end_date}
        jobGradeName={employee.job_grade_name}
        departmentName={employee.department_name}
        probationEndDate={employee.probation_end_date}
        confirmed={employee.confirmed ?? false}
        annualLeaveBalanceDays={Number(employee.annual_leave_balance_days ?? 0)}
        basicKobo={employee.basic_kobo}
        housingKobo={employee.housing_kobo}
        transportKobo={employee.transport_kobo}
        employerSignedAt={currentEmployerSignature?.signed_at}
        employeeSignedAt={currentEmployeeSignature?.signed_at}
      />

      {canSignAsEmployer && !currentEmployerSignature && (
        <SignContractForm
          action={signContractAsEmployer.bind(null, id)}
          label="Sign as the Employer"
          confirmTitle="Sign this contract as the Employer?"
          confirmMessage={`This records ${membership.orgName ?? "your organization"}'s acceptance of this contract exactly as shown above, with who signed, when, and from where kept as an audit record. If anything about this contract changes later (compensation, job grade, etc.), it will need to be signed again.`}
          documentHash={currentHash}
        />
      )}
    </div>
  );
}
