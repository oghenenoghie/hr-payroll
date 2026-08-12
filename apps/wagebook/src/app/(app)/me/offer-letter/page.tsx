import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { EmploymentLetter } from "@/components/EmploymentLetter";
import { PrintButton } from "@/components/PrintButton";

export default async function MyOfferLetterPage() {
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

  const { data: manager } = employee.manager_id
    ? await supabase.from("employees").select("full_name").eq("id", employee.manager_id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/me" className="text-[13px] font-bold text-primary">
          ← Back to overview
        </Link>
        <PrintButton>Print / Save as PDF</PrintButton>
      </div>
      <EmploymentLetter
        orgName={membership?.orgName ?? "Your organization"}
        fullName={employee.full_name}
        hireDate={employee.hire_date}
        employmentType={employee.employment_type}
        contractEndDate={employee.contract_end_date}
        jobGradeName={employee.job_grades?.name ?? null}
        departmentName={employee.departments?.name ?? null}
        managerName={manager?.full_name ?? null}
        probationEndDate={employee.probation_end_date}
        confirmed={employee.confirmed}
        basicKobo={employee.basic_kobo}
        housingKobo={employee.housing_kobo}
        transportKobo={employee.transport_kobo}
      />
    </div>
  );
}
