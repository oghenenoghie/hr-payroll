import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { TrainingCategoryBadge, Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { CourseForm } from "./CourseForm";
import { deleteCourse } from "../actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function TrainingCoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    redirect("/learning");
  }

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, title, category, is_mandatory, external_url")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/learning" className="text-[12px] font-bold text-primary">
          ← Learning &amp; Development
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Training Courses</span>
        <h1 className="text-[22px] font-extrabold text-ink">Course catalog</h1>
        <p className="text-[13px] text-ink-soft">
          Define the courses that can be assigned to employees. This is a catalog and a link to the actual
          material — the app doesn&apos;t host or play any content itself.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Title</th>
              <th className={`${thClass} text-center`}>Category</th>
              <th className={`${thClass} text-center`}>Mandatory</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {courses && courses.length > 0 ? (
              courses.map((course) => (
                <tr key={course.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>
                    {course.external_url ? (
                      <a href={course.external_url} target="_blank" rel="noreferrer" className="text-primary">
                        {course.title}
                      </a>
                    ) : (
                      course.title
                    )}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <TrainingCategoryBadge category={course.category} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    {course.is_mandatory ? <Badge tone="bad">Mandatory</Badge> : <span className="text-ink-soft">—</span>}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConfirmActionButton
                      action={deleteCourse.bind(null, course.id)}
                      label="Delete"
                      confirmTitle="Delete this course?"
                      confirmMessage={`"${course.title}" and every enrollment assigned against it will be removed.`}
                      confirmLabel="Delete"
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No courses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a course</span>
        <div className="mt-3">
          <CourseForm />
        </div>
      </div>
    </div>
  );
}
