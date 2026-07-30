"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

// For delete/approve/reject-style Server Actions rendered as a plain
// `<form action={fn.bind(null, id)}>` in a Server Component — replaces
// the bare submit button with one that confirms first, then invokes the
// already-bound action directly (Server Actions are callable as plain
// async functions, not only as a form's action), showing a pending state
// the whole time so a slow request can't look like the click did nothing.
export function ConfirmActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  tone = "danger",
  className,
  disabled,
}: {
  action: () => Promise<unknown> | unknown;
  label: string;
  pendingLabel?: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await action();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        className={
          className ??
          `text-[12px] font-bold disabled:opacity-50 ${tone === "danger" ? "text-bad" : "text-primary"}`
        }
      >
        {isPending ? pendingLabel : label}
      </button>
      {open && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmLabel}
          tone={tone}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
