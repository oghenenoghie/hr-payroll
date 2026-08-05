import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmploymentContract } from "@/components/EmploymentContract";
import { PrintButton } from "@/components/PrintButton";
import { SignContractForm } from "@/components/SignContractForm";
import { computeContractHash } from "@/lib/contract-hash";
import { signMyContract } from "./actions";

export default async function MyContractPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);

  // Reads the raw employees table, not employees_masked — salary masking
  // hides an employee's figures from OTHER viewers, never from the
  // employee's own view of their own record.
  const { data: employee } = await supabase
    .from("employees")
    .select("*, job_grades(name), departments(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!employee) {
    redirect("/me");
  }

  const { data: signatures } = await supabase
    .from("employment_contract_signatures")
    .select("party, document_hash, signed_at")
    .eq("employee_id", employee.id)
    .order("signed_at", { ascending: false });

  const currentHash = await computeContractHash({
    employmentType: employee.employment_type,
    hireDate: employee.hire_date,
    contractEndDate: employee.contract_end_date,
    jobGradeName: employee.job_grades?.name ?? null,
    departmentName: employee.departments?.name ?? null,
    probationEndDate: employee.probation_end_date,
    confirmed: employee.confirmed,
    annualLeaveBalanceDays: Number(employee.annual_leave_balance_days ?? 0),
    basicKobo: employee.basic_kobo,
    housingKobo: employee.housing_kobo,
    transportKobo: employee.transport_kobo,
  });

  const currentEmployerSignature = (signatures ?? []).find((s) => s.party === "employer" && s.document_hash === currentHash);
  const currentEmployeeSignature = (signatures ?? []).find((s) => s.party === "employee" && s.document_hash === currentHash);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/me" className="text-[13px] font-bold text-primary">
          ← Back to overview
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <EmploymentContract
        orgName={membership?.orgName ?? "Your organization"}
        fullName={employee.full_name}
        hireDate={employee.hire_date}
        employmentType={employee.employment_type}
        contractEndDate={employee.contract_end_date}
        jobGradeName={employee.job_grades?.name ?? null}
        departmentName={employee.departments?.name ?? null}
        probationEndDate={employee.probation_end_date}
        confirmed={employee.confirmed}
        annualLeaveBalanceDays={Number(employee.annual_leave_balance_days ?? 0)}
        basicKobo={employee.basic_kobo}
        housingKobo={employee.housing_kobo}
        transportKobo={employee.transport_kobo}
        employerSignedAt={currentEmployerSignature?.signed_at}
        employeeSignedAt={currentEmployeeSignature?.signed_at}
      />

      {!currentEmployeeSignature && (
        <SignContractForm
          action={signMyContract}
          label="Review and sign"
          confirmTitle="Sign this contract?"
          confirmMessage="This records your acceptance of this contract exactly as shown above, with when and from where kept as an audit record. If anything about this contract changes later (a raise, a title change, etc.), you'll be asked to sign again."
          documentHash={currentHash}
        />
      )}
    </div>
  );
}
