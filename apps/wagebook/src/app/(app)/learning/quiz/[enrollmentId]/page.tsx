import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizForm } from "./QuizForm";

export default async function TakeQuizPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS already scopes this to the caller's own enrollment — a mismatched
  // or someone-else's enrollment id just comes back empty, same as any
  // other RLS-scoped detail page in this app.
  const { data: enrollment } = await supabase
    .from("training_enrollments")
    .select("id, status, training_courses(id, title, has_quiz, quiz_passing_percent)")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment || !enrollment.training_courses) {
    notFound();
  }

  const course = enrollment.training_courses;

  if (!course.has_quiz) {
    redirect("/learning");
  }

  const questions: { question_id: string; question_text: string; options: { option_id: string; option_text: string }[] }[] =
    [];

  if (enrollment.status !== "completed") {
    const { data: rows } = await supabase.rpc("get_training_quiz_questions", { p_course_id: course.id });
    for (const row of rows ?? []) {
      let question = questions.find((q) => q.question_id === row.question_id);
      if (!question) {
        question = { question_id: row.question_id, question_text: row.question_text, options: [] };
        questions.push(question);
      }
      question.options.push({ option_id: row.option_id, option_text: row.option_text });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/learning" className="text-[12px] font-bold text-primary">
          ← Learning &amp; Development
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Quiz</span>
        <h1 className="text-[22px] font-extrabold text-ink">{course.title}</h1>
        <p className="text-[13px] text-ink-soft">
          Score {course.quiz_passing_percent}% or higher to mark this training complete. Answers are graded when
          you submit — there&apos;s no time limit, and you can try again if you don&apos;t pass.
        </p>
      </header>

      {enrollment.status === "completed" ? (
        <div className="rounded-panel border border-good bg-good-tint px-4 py-3 text-[13px] font-bold text-good">
          You&apos;ve already completed this training.
        </div>
      ) : questions.length > 0 ? (
        <QuizForm enrollmentId={enrollment.id} questions={questions} passingPercent={course.quiz_passing_percent} />
      ) : (
        <div className="rounded-card border border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-soft">
          This course&apos;s quiz isn&apos;t ready yet — check back later.
        </div>
      )}
    </div>
  );
}
