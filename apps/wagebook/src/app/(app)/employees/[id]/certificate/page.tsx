import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmploymentCertificate } from "@/components/EmploymentCertificate";
import { PrintButton } from "@/components/PrintButton";

export default async function EmployeeCertificatePage({ params }: { params: Promise<{ id: string }> }) {
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

  // Reads through the salary-masked view, same as the employee edit page:
  // an hr_manager viewer of a salary_masked employee gets null salary
  // columns back, which EmploymentCertificate renders as a restricted note
  // rather than a fabricated figure.
  const { data: employee } = await supabase.from("employees_masked").select("*").eq("id", id).maybeSingle();
  if (!employee) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/employees/${id}/edit`} className="text-[13px] font-bold text-primary">
          ← Back to employee
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <EmploymentCertificate
        orgName={membership.orgName ?? "Your organization"}
        fullName={employee.full_name ?? ""}
        hireDate={employee.hire_date}
        employmentType={employee.employment_type ?? "permanent"}
        status={employee.status ?? "active"}
        jobGradeName={employee.job_grade_name}
        departmentName={employee.department_name}
        basicKobo={employee.basic_kobo}
        housingKobo={employee.housing_kobo}
        transportKobo={employee.transport_kobo}
      />
    </div>
  );
}
