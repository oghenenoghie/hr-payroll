import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { TrainingCategoryBadge, TrainingEnrollmentStatusBadge, Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { EnrollForm } from "./EnrollForm";
import { CourseForm } from "./courses/CourseForm";
import { CourseMaterialsPanel } from "./courses/CourseMaterialsPanel";
import { QuizPanel } from "./courses/QuizPanel";
import { markEnrollmentComplete, deleteEnrollment, deleteCourse } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default async function LearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  const isHrOrAdmin = membership.role === "admin" || membership.role === "hr_manager";
  const isDepartmentManager = membership.role === "department_manager";
  const canViewOrgTraining =
    isHrOrAdmin || isDepartmentManager || ["auditor", "chro", "legal_compliance"].includes(membership.role);

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: myEnrollments }, { data: orgEnrollments }, { data: employees }, { data: courses }] =
    await Promise.all([
      myEmployee
        ? supabase
            .from("training_enrollments")
            .select(
              "id, status, due_date, completed_at, training_courses(id, title, category, is_mandatory, has_quiz)",
            )
            .eq("employee_id", myEmployee.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
      // RLS already scopes the rows returned to what this role can see —
      // admin/hr_manager get every enrollment, a department manager only
      // their own department's, auditor/chro/legal_compliance every
      // enrollment read-only — so no extra role filtering is needed here.
      canViewOrgTraining
        ? supabase
            .from("training_enrollments")
            .select("id, status, due_date, employee_id, employees(full_name), training_courses(title, category, is_mandatory)")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
      isHrOrAdmin
        ? supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .order("full_name")
        : Promise.resolve({ data: null }),
      // Full course fields when admin/hr_manager manage the catalog inline
      // on this same page; a plain id+title would do for anyone else, but
      // no other role ever needs the courses list at all.
      isHrOrAdmin
        ? supabase
            .from("training_courses")
            .select("id, title, category, is_mandatory, external_url, has_quiz, quiz_passing_percent")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);

  // Materials: admin/hr_manager manage the whole catalog inline here, so
  // they need every course's files, not just courses they themselves are
  // enrolled in — that superset also covers the "My training" download
  // links below when the admin/hr_manager also has an employee record.
  // Every other role only ever needs their own enrolled courses' files.
  const myCourseIds = [...new Set((myEnrollments ?? []).map((e) => e.training_courses?.id).filter((id): id is string => Boolean(id)))];
  const materialCourseIds = isHrOrAdmin ? (courses ?? []).map((c) => c.id) : myCourseIds;

  const { data: materialsRaw } =
    materialCourseIds.length > 0
      ? await supabase
          .from("training_course_materials")
          .select("id, course_id, file_name, storage_path, uploaded_at")
          .in("course_id", materialCourseIds)
          .order("uploaded_at", { ascending: false })
      : { data: null };

  const materialsWithUrls = await Promise.all(
    (materialsRaw ?? []).map(async (material) => {
      const { data: signed } = await supabase.storage
        .from("training-materials")
        .createSignedUrl(material.storage_path, 60 * 10);
      return { ...material, downloadUrl: signed?.signedUrl ?? null };
    }),
  );

  const materialsByCourse = new Map<string, typeof materialsWithUrls>();
  for (const material of materialsWithUrls) {
    const list = materialsByCourse.get(material.course_id) ?? [];
    list.push(material);
    materialsByCourse.set(material.course_id, list);
  }

  // Quiz questions/options are admin/hr_manager-only at the RLS layer, so
  // only this branch ever touches them — everyone else's completion path
  // goes through the safe get_training_quiz_questions()/
  // submit_training_quiz_attempt() RPCs on /learning/quiz/[enrollmentId].
  const [{ data: questionsRaw }, { data: optionsRaw }] = isHrOrAdmin
    ? await Promise.all([
        supabase
          .from("training_course_quiz_questions")
          .select("id, course_id, question_text")
          .order("sort_order", { ascending: true }),
        supabase
          .from("training_course_quiz_options")
          .select("id, question_id, option_text, is_correct")
          .order("sort_order", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];

  const optionsByQuestion = new Map<string, { id: string; option_text: string; is_correct: boolean }[]>();
  for (const option of optionsRaw ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  const questionsByCourse = new Map<
    string,
    { id: string; question_text: string; options: { id: string; option_text: string; is_correct: boolean }[] }[]
  >();
  for (const question of questionsRaw ?? []) {
    const list = questionsByCourse.get(question.course_id) ?? [];
    list.push({ ...question, options: optionsByQuestion.get(question.id) ?? [] });
    questionsByCourse.set(question.course_id, list);
  }

  const enrollFormCourses = [...(courses ?? [])].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Learning &amp; Development
        </span>
        <h1 className="text-[22px] font-extrabold text-ink">Training courses and completion tracking</h1>
        <p className="text-[13px] text-ink-soft">
          A course catalog entry can carry a link and/or directly attached files (slides, PDFs, short clips) —
          this isn&apos;t a video-streaming platform, just a place to assign and track training. A course with a
          quiz requires a passing score to complete; otherwise completion is self-reported by the employee.
        </p>
      </header>

      {myEmployee && (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">My training</span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Course</th>
                  <th className={`${thClass} text-center`}>Category</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  <th className={`${thClass} text-left`}>Materials</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {myEnrollments && myEnrollments.length > 0 ? (
                  myEnrollments.map((enrollment) => {
                    const materials = enrollment.training_courses?.id
                      ? (materialsByCourse.get(enrollment.training_courses.id) ?? [])
                      : [];
                    return (
                      <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                        <td className={`${tdClass} font-bold text-ink`}>
                          {enrollment.training_courses?.title ?? "—"}
                          {enrollment.training_courses?.is_mandatory && (
                            <span className="ml-2">
                              <Badge tone="bad">Mandatory</Badge>
                            </span>
                          )}
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <TrainingCategoryBadge category={enrollment.training_courses?.category ?? "other"} />
                        </td>
                        <td className={`${tdClass} text-ink-soft`}>{formatDate(enrollment.due_date)}</td>
                        <td className={`${tdClass} text-center`}>
                          <TrainingEnrollmentStatusBadge status={enrollment.status} />
                        </td>
                        <td className={tdClass}>
                          {materials.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {materials.map((material) =>
                                material.downloadUrl ? (
                                  <a
                                    key={material.id}
                                    href={material.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-primary"
                                  >
                                    {material.file_name}
                                  </a>
                                ) : (
                                  <span key={material.id} className="text-ink-soft">
                                    {material.file_name}
                                  </span>
                                ),
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          {enrollment.status === "assigned" &&
                            (enrollment.training_courses?.has_quiz ? (
                              <Link href={`/learning/quiz/${enrollment.id}`} className="text-[12px] font-bold text-primary">
                                Take quiz →
                              </Link>
                            ) : (
                              <ConfirmActionButton
                                action={markEnrollmentComplete.bind(null, enrollment.id)}
                                label="Mark complete"
                                tone="primary"
                                className="text-[12px] font-bold text-primary"
                                confirmTitle="Mark this course complete?"
                                confirmMessage="This confirms you've completed the training — it isn't verified against any quiz or certificate."
                                confirmLabel="Mark complete"
                              />
                            ))}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No training assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isHrOrAdmin && (
        <section className="flex flex-col gap-5">
          <h2 className="text-[16px] font-extrabold text-ink">Course catalog</h2>

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Title</th>
                  <th className={`${thClass} text-center`}>Category</th>
                  <th className={`${thClass} text-center`}>Mandatory</th>
                  <th className={`${thClass} text-center`}>Files</th>
                  <th className={`${thClass} text-center`}>Completion</th>
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
                      <td className={`${tdClass} text-center text-ink-soft`}>
                        {materialsByCourse.get(course.id)?.length ?? 0}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {course.has_quiz ? <Badge tone="good">Quiz</Badge> : <span className="text-ink-soft">Self-report</span>}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <ConfirmActionButton
                          action={deleteCourse.bind(null, course.id)}
                          label="Delete"
                          confirmTitle="Delete this course?"
                          confirmMessage={`"${course.title}", every enrollment and every attached file will be removed.`}
                          confirmLabel="Delete"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No courses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {courses && courses.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                {courses.map((course) => {
                  const materials = materialsByCourse.get(course.id) ?? [];
                  const questions = questionsByCourse.get(course.id) ?? [];
                  return (
                    <details key={course.id} className="rounded-card border border-border bg-surface">
                      <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold text-ink">
                        {course.title}{" "}
                        <span className="font-normal text-ink-soft">
                          ({materials.length} file{materials.length === 1 ? "" : "s"}, {questions.length} quiz
                          question{questions.length === 1 ? "" : "s"})
                        </span>
                      </summary>
                      <div className="flex flex-col gap-6 border-t border-border p-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Files</span>
                          <CourseMaterialsPanel courseId={course.id} materials={materials} />
                        </div>
                        <div className="flex flex-col gap-2 border-t border-border pt-4">
                          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Quiz</span>
                          <QuizPanel courseId={course.id} passingPercent={course.quiz_passing_percent} questions={questions} />
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-card border border-border bg-surface p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a course</span>
            <div className="mt-3">
              <CourseForm />
            </div>
          </div>
        </section>
      )}

      {canViewOrgTraining && (
        <section className="flex flex-col gap-5">
          <h2 className="text-[16px] font-extrabold text-ink">
            {isDepartmentManager && !isHrOrAdmin ? "Your department's training" : "Organization training"}
          </h2>

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Employee</th>
                  <th className={`${thClass} text-left`}>Course</th>
                  <th className={`${thClass} text-center`}>Category</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  {isHrOrAdmin && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {orgEnrollments && orgEnrollments.length > 0 ? (
                  orgEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b border-border last:border-b-0">
                      <td className={`${tdClass} font-bold text-ink`}>{enrollment.employees?.full_name ?? "—"}</td>
                      <td className={tdClass}>{enrollment.training_courses?.title ?? "—"}</td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingCategoryBadge category={enrollment.training_courses?.category ?? "other"} />
                      </td>
                      <td className={`${tdClass} text-ink-soft`}>{formatDate(enrollment.due_date)}</td>
                      <td className={`${tdClass} text-center`}>
                        <TrainingEnrollmentStatusBadge status={enrollment.status} />
                      </td>
                      {isHrOrAdmin && (
                        <td className={`${tdClass} text-right`}>
                          <ConfirmActionButton
                            action={deleteEnrollment.bind(null, enrollment.id)}
                            label="Remove"
                            confirmTitle="Remove this enrollment?"
                            confirmMessage={`${enrollment.employees?.full_name ?? "This employee"}'s assignment to "${enrollment.training_courses?.title ?? "this course"}" will be removed.`}
                            confirmLabel="Remove"
                          />
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isHrOrAdmin ? 6 : 5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                      No training assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isHrOrAdmin && (
            <div className="rounded-card border border-border bg-surface p-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Assign training</span>
              <div className="mt-3">
                <EnrollForm employees={employees ?? []} courses={enrollFormCourses} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
