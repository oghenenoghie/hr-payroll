"use client";

import { useTransition } from "react";
import { updateRequisitionStatus } from "./actions";

const STATUSES = ["open", "on_hold", "closed", "filled"];

export function RequisitionStatusSelect({ requisitionId, status }: { requisitionId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => {
          updateRequisitionStatus(requisitionId, next);
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
