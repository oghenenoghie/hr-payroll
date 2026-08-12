"use client";

import { useActionState, useState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { createAsset } from "./actions";

const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function AssetForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createAsset, null);
  const [method, setMethod] = useState<"straight_line" | "declining_balance">("straight_line");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Asset name" name="name" />
        <FormField label="Category" name="category" required={false} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Acquisition date" name="acquisition_date" type="date" />
        <FormField label="Useful life (months)" name="useful_life_months" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Cost (₦)" name="cost" type="number" />
        <FormField label="Salvage value (₦)" name="salvage_value" type="number" required={false} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="depreciation_method">
            Depreciation method
          </label>
          <select
            id="depreciation_method"
            name="depreciation_method"
            value={method}
            onChange={(event) => setMethod(event.target.value as "straight_line" | "declining_balance")}
            className={selectClass}
          >
            <option value="straight_line">Straight-line</option>
            <option value="declining_balance">Declining balance</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="department_id">
            Department
          </label>
          <select id="department_id" name="department_id" defaultValue="" className={selectClass}>
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {method === "declining_balance" && (
        <FormField label="Declining-balance rate (% per year)" name="declining_balance_rate_percent" type="number" />
      )}
      <SubmitButton>Add asset</SubmitButton>
    </form>
  );
}
