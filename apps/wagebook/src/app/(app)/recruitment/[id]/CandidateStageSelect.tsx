"use client";

import { useTransition } from "react";
import { updateCandidateStage } from "../actions";

const STAGES = ["applied", "screening", "interviewing", "offer", "hired", "rejected"];

export function CandidateStageSelect({
  candidateId,
  requisitionId,
  stage,
}: {
  candidateId: string;
  requisitionId: string;
  stage: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stage}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => {
          updateCandidateStage(candidateId, requisitionId, next);
        });
      }}
      className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] font-bold text-ink outline-none focus:border-primary disabled:opacity-50"
    >
      {STAGES.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
