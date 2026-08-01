import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmploymentLetter } from "@/components/EmploymentLetter";
import { PrintButton } from "@/components/PrintButton";

export default async function EmployeeOfferLetterPage({ params }: { params: Promise<{ id: string }> }) {
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
  // back, which EmploymentLetter renders as a restricted note.
  const { data: employee } = await supabase
    .from("employees_masked")
    .select(
      "full_name, hire_date, employment_type, contract_end_date, job_grade_name, department_name, manager_id, probation_end_date, confirmed, basic_kobo, housing_kobo, transport_kobo",
    )
    .eq("id", id)
    .maybeSingle();
  if (!employee) notFound();

  const { data: manager } = employee.manager_id
    ? await supabase.from("employees").select("full_name").eq("id", employee.manager_id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/employees/${id}/edit`} className="text-[13px] font-bold text-primary">
          ← Back to employee
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <EmploymentLetter
        orgName={membership.orgName ?? "Your organization"}
        fullName={employee.full_name ?? ""}
        hireDate={employee.hire_date}
        employmentType={employee.employment_type ?? "permanent"}
        contractEndDate={employee.contract_end_date}
        jobGradeName={employee.job_grade_name}
        departmentName={employee.department_name}
        managerName={manager?.full_name ?? null}
        probationEndDate={employee.probation_end_date}
        confirmed={employee.confirmed ?? false}
        basicKobo={employee.basic_kobo}
        housingKobo={employee.housing_kobo}
        transportKobo={employee.transport_kobo}
      />
    </div>
  );
}
