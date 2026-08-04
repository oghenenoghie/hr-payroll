"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { transferAsset } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function TransferForm({ assetId, departments }: { assetId: string; departments: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(transferAsset, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="asset_id" value={assetId} />
      <FormError message={state?.error} />
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="to_department_id">
          New department
        </label>
        <select id="to_department_id" name="to_department_id" defaultValue="" className={selectClass}>
          <option value="">Unassigned</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="note">
          Note
        </label>
        <input id="note" name="note" type="text" className={selectClass} />
      </div>
      <SubmitButton>Transfer asset</SubmitButton>
    </form>
  );
}
