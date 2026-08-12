"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { submitQuizAttempt, type SubmitQuizState } from "../../actions";

type Option = { option_id: string; option_text: string };
type Question = { question_id: string; question_text: string; options: Option[] };

export function QuizForm({
  enrollmentId,
  questions,
  passingPercent,
}: {
  enrollmentId: string;
  questions: Question[];
  passingPercent: number;
}) {
  const [state, formAction] = useActionState<SubmitQuizState, FormData>(
    (prevState, formData) => submitQuizAttempt(enrollmentId, prevState, formData),
    null,
  );

  if (state?.result) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className={`rounded-panel border px-4 py-3 text-[13px] font-bold ${
            state.result.passed ? "border-good bg-good-tint text-good" : "border-bad bg-bad-tint text-bad"
          }`}
        >
          {state.result.passed
            ? `You passed with a score of ${state.result.scorePercent}% (${passingPercent}% required). This training is now marked complete.`
            : `You scored ${state.result.scorePercent}% — ${passingPercent}% is required to pass. Try again below.`}
        </div>
        {state.result.passed ? (
          <Link href="/learning" className="w-fit text-[12.5px] font-bold text-primary">
            ← Back to Learning
          </Link>
        ) : (
          <a href={`/learning/quiz/${enrollmentId}`} className="w-fit text-[12.5px] font-bold text-primary">
            Try again →
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormError message={state?.error} />
      {questions.map((question, i) => (
        <div key={question.question_id} className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-ink">
            {i + 1}. {question.question_text}
          </span>
          <div className="flex flex-col gap-1">
            {question.options.map((option) => (
              <label key={option.option_id} className="flex items-center gap-2 text-[13px] text-ink">
                <input type="radio" name={`question_${question.question_id}`} value={option.option_id} required className="h-4 w-4" />
                {option.option_text}
              </label>
            ))}
          </div>
        </div>
      ))}
      <SubmitButton>Submit answers</SubmitButton>
    </form>
  );
}
