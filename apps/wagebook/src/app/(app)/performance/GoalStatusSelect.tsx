"use client";

import { useTransition } from "react";
import { updateGoalStatus } from "./actions";

const STATUSES = ["not_started", "in_progress", "completed", "cancelled"];

export function GoalStatusSelect({ goalId, status }: { goalId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => {
          updateGoalStatus(goalId, next);
        });
      }}
      className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] font-bold text-ink outline-none focus:border-primary disabled:opacity-50"
    >
      {STATUSES.map((value) => (
        <option key={value} value={value}>
          {value.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
