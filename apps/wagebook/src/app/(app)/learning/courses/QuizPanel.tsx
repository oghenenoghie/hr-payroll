"use client";

import { useActionState } from "react";
import { FormField, FormError, SubmitButton } from "@/components/AuthCard";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { Badge } from "@/components/Badge";
import { createQuizQuestion, deleteQuizQuestion, type FormState } from "../actions";

type Option = { id: string; option_text: string; is_correct: boolean };
type Question = { id: string; question_text: string; options: Option[] };

const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function QuizPanel({
  courseId,
  passingPercent,
  questions,
}: {
  courseId: string;
  passingPercent: number;
  questions: Question[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    (prevState, formData) => createQuizQuestion(courseId, prevState, formData),
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-ink-soft">
        Passing score: <span className="font-bold text-ink">{passingPercent}%</span>. Once this course has at
        least one question, employees can no longer self-report it complete — they must pass this quiz instead.
      </p>

      {questions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {questions.map((question, i) => (
            <div key={question.id} className="rounded-control border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-bold text-ink">
                  {i + 1}. {question.question_text}
                </span>
                <ConfirmActionButton
                  action={deleteQuizQuestion.bind(null, question.id)}
                  label="Delete"
                  confirmTitle="Delete this question?"
                  confirmMessage="This question and its options will be permanently removed."
                  confirmLabel="Delete"
                />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {question.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <span>{option.option_text}</span>
                    {option.is_correct && <Badge tone="good">Correct</Badge>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft">No quiz questions yet — this course is completed by self-report.</p>
      )}

      <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-3">
        <FormError message={state?.error} />
        <FormField label="Question" name="question_text" />
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Answer options (2–4, pick the correct one)</label>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct_option" value={i} defaultChecked={i === 1} className="h-4 w-4 shrink-0" />
              <input
                type="text"
                name={`option_${i}`}
                required={i <= 2}
                placeholder={i <= 2 ? `Option ${i}` : `Option ${i} (optional)`}
                className="w-full rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
        <SubmitButton>Add question</SubmitButton>
      </form>
    </div>
  );
}
