import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { JobGradeForm } from "./JobGradeForm";
import { deleteJobGrade } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function JobGradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { data: jobGrades } = await supabase.from("job_grades").select("*").order("min_annual_kobo");

  const { data: employees } = await supabase.from("employees").select("job_grade_id");

  const employeeCountByGrade = new Map<string, number>();
  for (const employee of employees ?? []) {
    if (!employee.job_grade_id) continue;
    employeeCountByGrade.set(employee.job_grade_id, (employeeCountByGrade.get(employee.job_grade_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Job Grades</span>
        <h1 className="text-[22px] font-extrabold text-ink">Salary bands for employee assignment</h1>
        <p className="text-[13px] text-ink-soft">
          Assign employees to a grade on their edit page. When an employee&apos;s annual contractual pay (basic +
          housing + transport) falls outside their assigned grade&apos;s band, the edit page flags it.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Grade</th>
              <th className={`${thClass} text-right`}>Min annual</th>
              <th className={`${thClass} text-right`}>Max annual</th>
              <th className={`${thClass} text-center`}>Employees</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {jobGrades && jobGrades.length > 0 ? (
              jobGrades.map((grade) => (
                <tr key={grade.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{grade.name}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(grade.min_annual_kobo))}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(grade.max_annual_kobo))}</td>
                  <td className={`${tdClass} text-center text-ink-soft`}>
                    {employeeCountByGrade.get(grade.id) ?? 0}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <form action={deleteJobGrade.bind(null, grade.id)}>
                      <button type="submit" className="text-[12px] font-bold text-bad">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No job grades yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <JobGradeForm />
      </div>
    </div>
  );
}
