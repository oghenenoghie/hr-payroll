"use client";

import { useActionState, useState } from "react";
import type { Tables } from "@plutus/core";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { deleteAccount, updateAccount, type UpdateAccountState } from "./actions";

const TYPE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

const thTdShared = "px-3 py-[10px] text-[13px]";

export function EditAccountRow({ account, canManage }: { account: Tables<"chart_of_accounts">; canManage: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction] = useActionState<UpdateAccountState, FormData>(
    (prevState, formData) => updateAccount(account.id, prevState, formData),
    null,
  );

  if (isEditing) {
    return (
      <tr className="border-b border-border last:border-b-0">
        <td colSpan={canManage ? 4 : 3} className="p-0">
          <form action={formAction} className="flex flex-col gap-3 px-3 py-3">
            <FormError message={state?.error} />
            <FormNotice message={state?.success ? "Account updated." : undefined} />
            <div className="grid grid-cols-2 gap-3">
              {account.is_system ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Code</span>
                  <span className="rounded-control border border-border bg-bg px-[13px] py-[11px] font-mono text-[13px] text-ink-soft">
                    {account.code}
                  </span>
                </div>
              ) : (
                <FormField label="Code" name="code" defaultValue={account.code} />
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`type-${account.id}`}>
                  Type
                </label>
                <select
                  id={`type-${account.id}`}
                  name="type"
                  defaultValue={account.type}
                  className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <FormField label="Name" name="name" defaultValue={account.name} />
            <FormField label="Description" name="description" defaultValue={account.description ?? ""} required={false} />
            <div className="flex items-center gap-3">
              <SubmitButton>Save changes</SubmitButton>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-[12px] font-bold text-ink-soft"
              >
                {state?.success ? "Close" : "Cancel"}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className={`${thTdShared} font-mono text-ink-soft`}>{account.code}</td>
      <td className={`${thTdShared} font-bold text-ink`}>{account.name}</td>
      <td className={`${thTdShared} text-center`}>
        {account.is_system ? <Badge tone="neutral">System</Badge> : <Badge tone="good">Custom</Badge>}
      </td>
      {canManage && (
        <td className={`${thTdShared} text-right`}>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setIsEditing(true)} className="text-[12px] font-bold text-primary">
              Edit
            </button>
            {!account.is_system && (
              <ConfirmActionButton
                action={deleteAccount.bind(null, account.id)}
                label="Delete"
                confirmTitle="Delete this account?"
                confirmMessage={`"${account.code} · ${account.name}" will be removed from the chart of accounts. Any existing ledger postings already made against this code are unaffected, but nothing new can post to it once it's gone.`}
                confirmLabel="Delete"
              />
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
