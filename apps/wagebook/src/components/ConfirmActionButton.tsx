"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

// For delete/approve/reject-style Server Actions rendered as a plain
// `<form action={fn.bind(null, id)}>` in a Server Component — replaces
// the bare submit button with one that confirms first, then invokes the
// already-bound action directly (Server Actions are callable as plain
// async functions, not only as a form's action), showing a pending state
// the whole time so a slow request can't look like the click did nothing.
//
// variant/size come from the shared Button spec (see
// .claude/skills/plutus-button-nav-system/SKILL.md) — no className prop,
// so every confirm-gated action in the app renders one of the five
// canonical variants instead of a hand-typed string. Defaults to
// "danger"/"row" since this component gates almost entirely
// delete/remove/reject-style actions; pass variant="row" explicitly for
// a non-destructive row action (e.g. "Approve"), or size="md" for a
// non-row context like a page-level "Delete" action.
export function ConfirmActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "row",
  disabled,
}: {
  action: () => Promise<unknown> | unknown;
  label: string;
  pendingLabel?: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
        className={buttonClasses(variant, size)}
      >
        {isPending ? pendingLabel : label}
      </button>
      {open && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmLabel}
          tone={variant === "danger" ? "danger" : "primary"}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
