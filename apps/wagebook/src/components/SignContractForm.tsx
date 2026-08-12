"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type SignContractState = { error?: string } | null;

// Shared by both signing surfaces (the employee's own /me/contract and
// admin/HR's /employees/[id]/contract) — only the bound Server Action and
// the consent copy differ between them, matching this codebase's
// bind-the-id-then-pass-to-useActionState pattern used for approve/
// discard/reverse actions elsewhere.
export function SignContractForm({
  action,
  label,
  confirmTitle,
  confirmMessage,
  documentHash,
}: {
  action: (prevState: SignContractState, formData: FormData) => Promise<SignContractState>;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  documentHash: string;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <FormError message={state?.error} />
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
      >
        {isPending ? "Signing…" : label}
      </button>

      {confirming && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          tone="primary"
          confirmLabel="Sign"
          onConfirm={() => {
            setConfirming(false);
            const formData = new FormData();
            formData.set("document_hash", documentHash);
            formAction(formData);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
