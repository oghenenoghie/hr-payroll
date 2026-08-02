"use client";

import { useTransition } from "react";
import { updateReviewCycleStatus } from "./actions";

const STATUSES = ["draft", "active", "closed"];

export function CycleStatusSelect({ cycleId, status }: { cycleId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => {
          updateReviewCycleStatus(cycleId, next);
        });
      }}
      className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] font-bold text-ink outline-none focus:border-primary disabled:opacity-50"
    >
      {STATUSES.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
